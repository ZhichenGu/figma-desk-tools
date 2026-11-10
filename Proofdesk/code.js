const fields = ['fontName','fontSize','lineHeight','letterSpacing']
let snapshot, busy = false, revision = 0
figma.showUI(__html__, {width:470,height:570,themeColors:true})
const post = (type,data) => figma.ui.postMessage({type,data})
const key = x => JSON.stringify(x)
function scope() {
  const page = figma.currentPage
  return key([page.id,page.selection.map(n=>n.id).sort()])
}
function scan() {
  const page = figma.currentPage, selected = page.selection
  const nodes = new Map()
  for (const root of selected.length ? selected : [page]) {
    if (root.type === 'TEXT') nodes.set(root.id,root)
    if ('findAllWithCriteria' in root) {
      for (const n of root.findAllWithCriteria({types:['TEXT']})) nodes.set(n.id,n)
    }
  }
  const docs = Array.from(nodes.values(), n=>({id:n.id,name:n.name,locked:!editable(n),text:n.characters,runs:n.getStyledTextSegments(fields)}))
  snapshot = {scope:scope(),docs}
  revision++
  const label = selected.length===1 ? selected[0].name : selected.length ? selected.length+' 个选中对象' : '整页 · '+page.name
  post('scan',{docs,label,revision,baseline:JSON.parse(figma.root.getPluginData('typeBaseline')||'null')})
}
function value(run,field) {
  if (field==='family') return run.fontName.family
  if (field==='style') return run.fontName.style
  if (field==='all') return fields.map(f=>run[f])
  return run[field]
}
function editable(n) {
  for (let p=n;p;p=p.parent) if (p.locked) return false
  return true
}
async function replace(m) {
  const before = snapshot
  if (!before || scope()!==before.scope) throw Error('范围已改变，请重新扫描。')
  const jobs=[], fonts=new Map(), originals=new Map()
  const excluded=new Set(m.excluded||[])
  let skipped=0
  for (const d of before.docs) {
    const matches=d.runs.filter(r=>key(value(r,m.group))===m.match && !excluded.has(key([d.id,r.start,r.end])))
    if (!matches.length) continue
    const n=await figma.getNodeByIdAsync(d.id)
    if (!n || n.characters!==d.text || key(n.getStyledTextSegments(fields))!==key(d.runs)) throw Error('文字已改变，请重新扫描。')
    if (!editable(n)) {skipped+=matches.length;continue}
    for (const r of matches) {
      let v=m.target
      if (m.field==='family'||m.field==='style') v={family:m.field==='family'?v:r.fontName.family,style:m.field==='style'?v:r.fontName.style}
      fonts.set(key(r.fontName),r.fontName)
      if (typeof v==='object' && v.family) fonts.set(key(v),v)
      jobs.push({n,r,v})
    }
  }
  for (const f of fonts.values()) {
    try {await figma.loadFontAsync(f)} catch (_) {throw Error('字体不可用：'+f.family+' '+f.style)}
  }
  if (scope()!==before.scope) throw Error('范围已改变，请重新扫描。')
  const setters={family:'setRangeFontName',style:'setRangeFontName',fontSize:'setRangeFontSize',lineHeight:'setRangeLineHeight',letterSpacing:'setRangeLetterSpacing'}
  async function positions(node){
    try{return await node.exportAsync({format:'SVG_STRING',svgOutlineText:false,svgIdAttribute:false})}
    catch(_){return null}
  }
  for(const {n} of jobs)if(!originals.has(n))originals.set(n,await positions(n))
  validateRevision(m)
  for(const [n] of originals){
    const doc=before.docs.find(d=>d.id===n.id)
    if(n.removed||!editable(n)||n.characters!==doc.text||key(n.getStyledTextSegments(fields))!==key(doc.runs))throw Error('文字已变化，请重新扫描。')
  }
  let done=0
  try {
    for (const {n,r,v} of jobs) {n[setters[m.field]](r.start,r.end,v);done++}
  } finally {
    if(done) figma.commitUndo()
    const checks=[]
    for(const [n,previous] of originals)checks.push({id:n.id,name:n.name,before:previous,after:await positions(n)})
    scan()
    post('review',checks)
    post('status','已修改 '+done+' 处，锁定跳过 '+skipped+' 处。')
  }
}
async function correct(message) {
  const before = snapshot
  const documents = new Map(before.docs.map(d => [d.id, d]))
  const plans = new Map()
  let skipped = 0
  for (const hit of message.hits) {
    const doc = documents.get(hit.id)
    if (!doc || doc.text.slice(hit.start, hit.start + hit.word.length) !== hit.word) throw Error('原句已变化，请重新扫描。')
    if (!plans.has(doc.id)) {
      const node = await figma.getNodeByIdAsync(doc.id)
      if (!node || node.characters !== doc.text) throw Error('原句已变化，请重新扫描。')
      plans.set(doc.id, {node, doc, hits: []})
    }
    plans.get(doc.id).hits.push(hit)
  }
  const fonts = new Map()
  for (const {node,doc} of plans.values()) {
    if (editable(node)) for (const f of node.getRangeAllFontNames(0,doc.text.length)) fonts.set(key(f),f)
  }
  for (const font of fonts.values()) await figma.loadFontAsync(font)
  validateRevision(message)
  for (const {node,doc} of plans.values()) {
    if (node.removed || node.characters !== doc.text) throw Error('原句已变化，请重新扫描。')
  }
  let done = 0
  try {
    for (const {node,hits} of plans.values()) {
      if (!editable(node)) { skipped += hits.length; continue }
      for (const {start,word} of hits.sort((a,b) => b.start-a.start)) {
        const next = /^[A-Z]/.test(word) ? message.target[0].toUpperCase()+message.target.slice(1) : message.target
        node.insertCharacters(start,next,'AFTER')
        try {node.deleteCharacters(start+next.length,start+next.length+word.length)}
        catch(error) {node.deleteCharacters(start,start+next.length);throw error}
        done++
      }
    }
  } finally {
    if (done) figma.commitUndo()
    scan()
  }
  post('status','已替换 '+done+' 处'+(skipped?'，锁定跳过 '+skipped+' 处':'')+'。')
}
function validateRevision(m) {
  if (!snapshot || m.revision !== revision || snapshot.scope !== scope()) throw Error('范围已变化，请查看最新扫描结果。')
}
function followSelection() {
  if (!busy && snapshot && snapshot.scope !== scope()) scan()
}
figma.on('selectionchange',followSelection)
figma.on('currentpagechange',followSelection)

function imageSelection() {
  const selection = figma.currentPage.selection
  if (selection.length !== 1) return null
  const node = selection[0]
  if (!('fills' in node) || !Array.isArray(node.fills)) return null
  const visible = node.fills.filter(paint => paint.type === 'IMAGE' && paint.visible !== false)
  if (visible.length !== 1 || !visible[0].imageHash) return null
  return {node, paint:visible[0]}
}
async function handleImage(message) {
  validateRevision(message)
  const selected = imageSelection()
  if (!selected) throw Error('请选择一个只有一层可见图片填充的图层。')
  const {node,paint} = selected
  if (message.type === 'readImage') {
    const source = figma.getImageByHash(paint.imageHash)
    const size = await source.getSizeAsync()
    if (Math.max(size.width,size.height)>4096) throw Error('请使用长边不超过 4096 像素的图片。')
    const bytes = await source.getBytesAsync()
    validateRevision(message)
    post('imageSource',{revision,bytes,hash:paint.imageHash,id:node.id})
    return
  }
  if (!editable(node)) throw Error('请先解锁图片图层。')
  if (node.id !== message.id || paint.imageHash !== message.hash) throw Error('原图已变化，请重新预览。')
  const hash = figma.createImage(message.bytes).hash
  node.fills = node.fills.map(fill => fill.type==='IMAGE' && fill.visible!==false && fill.imageHash===paint.imageHash ? {...fill,imageHash:hash} : fill)
  figma.commitUndo()
  scan()
  post('status','已应用透明背景，可在 Figma 中撤销。')
}

figma.ui.onmessage=async m=>{
 // Set this plugin's GitHub repository URL when it is published.
 const githubRepository = 'https://github.com/ZhichenGu/figma-desk-tools/releases/latest'
 if(m.type==='getLanguageSettings'){
  let language
  try{language=await figma.clientStorage.getAsync('interfaceLanguage')}catch(e){}
  figma.ui.postMessage({type:'languageSettings',language,hasRepo:!!githubRepository})
  return
 }
 if(m.type==='saveLanguage'){
  if(['zh','en'].includes(m.language))await figma.clientStorage.setAsync('interfaceLanguage',m.language)
  return
 }
 if(m.type==='openProjectRepo'){
  if(githubRepository)figma.openExternal(githubRepository)
  return
 }

  if(busy) return
  busy=true
  try {
    if(m.type==='setBaseline'){
      validateRevision(m)
      const page=figma.currentPage, roots=page.selection
      if(roots.length>1)throw Error('请选择一个参考画板，或取消选择以使用整页。')
      const catalog=new Map()
      for(const d of snapshot.docs){
        const node=await figma.getNodeByIdAsync(d.id)
        if(!node||node.characters!==d.text||key(node.getStyledTextSegments(fields))!==key(d.runs))throw Error('参考文字已变化，请重新扫描。')
        for(const run of d.runs){
          if(!d.text.slice(run.start,run.end).trim())continue
          const style=fields.map(f=>run[f]);catalog.set(key(style),style)
        }
      }
      validateRevision(m)
      if(!catalog.size)throw Error('参考范围内没有文字。')
      const baseline={name:page.name+(roots.length?' / '+roots[0].name:''),styles:[...catalog.values()]}
      const serialized=JSON.stringify(baseline)
      if(serialized.length>22000)throw Error('样式过多，请选择一个更小的参考画板。')
      figma.root.setPluginData('typeBaseline',serialized);scan()
      post('status','已保存项目样式基准。')
    }
    if(m.type==='readImage'||m.type==='applyImage') await handleImage(m)
    if(m.type==='acceptProject'){
      validateRevision(m)
      const words=JSON.parse(figma.root.getPluginData('acceptedWords')||'[]')
      if(!words.includes(m.word))words.push(m.word)
      figma.root.setPluginData('acceptedWords',JSON.stringify(words));post('projectWords',words)
    }
    if(m.type==='reviewGo'){
      const n=await figma.getNodeByIdAsync(m.id);if(n&&!n.removed)figma.viewport.scrollAndZoomIntoView([n])
    }
    if(m.type==='scan') {scan();post('projectWords',JSON.parse(figma.root.getPluginData('acceptedWords')||'[]')); post('words',await figma.clientStorage.getAsync('words')||[])}
    if(['go','correct','replace'].includes(m.type)) validateRevision(m)
    if(m.type==='correct') await correct(m)
    if(m.type==='go') {
      const n=await figma.getNodeByIdAsync(m.id)
      if(n && !n.removed) {
        if(m.word) {
          validateRevision(m)
          const doc=snapshot.docs.find(d=>d.id===n.id)
          if (!doc || n.characters!==doc.text || n.characters.slice(m.start,m.start+m.word.length)!==m.word) throw Error('原句已变化，请重新扫描。')
          figma.currentPage.selectedTextRange={node:n,start:m.start,end:m.start+m.word.length}
          snapshot.scope=scope()
        }
        figma.viewport.scrollAndZoomIntoView([n])
      }
    }
    if(m.type==='add') {
      const words=await figma.clientStorage.getAsync('words')||[]
      if(!words.includes(m.word)) words.push(m.word)
      await figma.clientStorage.setAsync('words',words); post('words',words)
    }
    if(m.type==='replace') await replace(m)
  } catch(e) {post('status',String(e.message||e))}
  finally {busy=false; followSelection(); post('ready',true)}
}
