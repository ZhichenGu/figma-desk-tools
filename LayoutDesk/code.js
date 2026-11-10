const localCaptureKey = ""
figma.showUI(__html__,{width:1000,height:690,themeColors:true})
const post=(type,data)=>figma.ui.postMessage({type,data})
const rgb=hex=>({r:((hex>>16)&255)/255,g:((hex>>8)&255)/255,b:(hex&255)/255})
const paint=hex=>[{type:'SOLID',color:rgb(hex)}]
let anchor=null, busy=false
async function referenceSelection(roots){
 const page=figma.currentPage
 const chosen=new Set(roots.map(n=>n.id))
 const top=roots.filter(n=>{for(let p=n.parent;p;p=p.parent)if(chosen.has(p.id))return false;return n.visible!==false&&n.absoluteBoundingBox})
 if(!top.length)throw Error('请先选中可见的参考图层。')
 function order(n){const path=[];for(let p=n;p.parent&&p.parent.type!=='DOCUMENT';p=p.parent)path.unshift(p.parent.children.indexOf(p));return path}
 const entries=top.map(n=>({n,b:n.absoluteBoundingBox,path:order(n)})).sort((a,b)=>{
  for(let i=0;i<Math.min(a.path.length,b.path.length);i++)if(a.path[i]!==b.path[i])return a.path[i]-b.path[i]
  return 0
 })
 const x=Math.min(...entries.map(e=>e.b.x)),y=Math.min(...entries.map(e=>e.b.y))
 const w=Math.max(...entries.map(e=>e.b.x+e.b.width))-x,h=Math.max(...entries.map(e=>e.b.y+e.b.height))-y
 if(w<1||h<1)throw Error('参考选区太小。')
 const scale=Math.min(1,1800/Math.max(w,h)),layers=[],slots=[]
 function inspect(n,bounds){
  if(!n.visible||!n.absoluteBoundingBox)return
  const b=n.absoluteBoundingBox, left=Math.max(bounds.x,b.x),up=Math.max(bounds.y,b.y)
  const width=Math.min(bounds.x+bounds.w,b.x+b.width)-left,height=Math.min(bounds.y+bounds.h,b.y+b.height)-up
  if(width<1||height<1)return
  const image=Array.isArray(n.fills)&&n.fills.some(f=>f.type==='IMAGE'&&f.visible!==false)
  if(n.type==='TEXT'||image)slots.push({k:n.type==='TEXT'?'text':'image',n:n.name.slice(0,55),x:left-x,y:up-y,w:width,h:height,size:typeof n.fontSize==='number'?n.fontSize:18,face:n.fontName&&n.fontName.style||'Regular',family:n.fontName&&n.fontName.family||'Inter',content:'',auto:false})
  if('children' in n)for(const child of n.children)inspect(child,n.clipsContent?{x:left,y:up,w:width,h:height}:bounds)
 }
 for(const {n,b} of entries){
  layers.push({x:b.x-x,y:b.y-y,w:b.width,h:b.height,bytes:await n.exportAsync({format:'PNG',useAbsoluteBounds:true,constraint:{type:'SCALE',value:scale}})})
  inspect(n,{x,y,w,h})
 }
 if(figma.currentPage!==page)throw Error('当前页面已改变，请重新选择参考。')
 anchor={page:page.id,x:x+w+64,y}
 post('canvasReference',{layers,slots,w,h,scale,name:top.length===1?top[0].name:'画布选区',key:JSON.stringify(roots.map(n=>n.id).sort()),raster:slots.every(s=>s.k==='image')&&slots.length===1&&top.length===1})
}

function collectMaterials(roots){
 const nodes=new Map()
 function visit(n){
  if(!n.visible || nodes.has(n.id))return
  if(n.type==='TEXT'){nodes.set(n.id,n);return}
  if(Array.isArray(n.fills)&&n.fills.some(f=>f.type==='IMAGE'&&f.visible!==false)){nodes.set(n.id,n);return}
  if('children' in n)n.children.forEach(visit)
 }
 roots.forEach(visit)
 return nodes
}
function selectionInfo(){
 const roots=figma.currentPage.selection,nodes=[...collectMaterials(roots).values()]
 post('selectionInfo',{resumable:roots.length===1&&!!roots[0].getPluginData('deskParts'),images:nodes.filter(n=>n.type!=='TEXT').length,texts:nodes.filter(n=>n.type==='TEXT').length})
}
let picker=null
function selectionKey(){return JSON.stringify(figma.currentPage.selection.map(n=>n.id).sort())}
function endPick(){
 picker=null
 figma.ui.resize(1000,690)
}
async function takePicked(confirm){
 const session=picker
 if(!session||session.reading)return
 const nodes=[...collectMaterials(figma.currentPage.selection).values()]
 if(!nodes.length){post('pickHint','请选择文字图层或含图片填充的图层。');return}
 if(!confirm&&(session.batch||nodes.length!==1||selectionKey()===session.initial||nodes[0].type==='TEXT'&&session.kind!=='text'||nodes[0].type!=='TEXT'&&session.kind!=='image')){
  post('pickHint','已选 '+nodes.length+' 项，可点击「使用选区」核对位置。');return
 }
 session.reading=true
 try{await selection(false,null,false,session)}
 catch(e){if(picker===session)post('pickHint',String(e.message||e))}
 finally{session.reading=false}
}
figma.on('selectionchange',()=>{selectionInfo();if(picker)takePicked(false)})
async function selection(reference,referenceKey,grouped,session){
 const roots=[...figma.currentPage.selection]
 if(!roots.length)throw Error('请先在画布上框选素材。')
 if(reference)return referenceSelection(roots)
 const selectionAtStart=selectionKey()
 const nodes=collectMaterials(roots)
 if(JSON.stringify(roots.map(n=>n.id).sort())===referenceKey)throw Error('这是刚才的参考选区，请另选自己的素材。')
 const ordered=[...nodes.values()].sort((a,b)=>a.absoluteTransform[1][2]-b.absoluteTransform[1][2]||a.absoluteTransform[0][2]-b.absoluteTransform[0][2])
 const items=[]
 for(const n of ordered){
  if(n.type==='TEXT')items.push({k:'text',name:n.name,text:n.characters})
  else {const f=n.fills.find(f=>f.type==='IMAGE'&&f.visible!==false);items.push({k:'image',name:n.name,bytes:await figma.getImageByHash(f.imageHash).getBytesAsync()})}
 }
 if(!items.length)throw Error('选区没有可读取的图片或文字。')
 if(session){
  if(session!==picker)return
  if(selectionKey()!==selectionAtStart){post('pickHint','选区已改变，请点「使用选区」。');return}
  endPick();post('picked',{items,batch:session.batch});return
 }
 const boxes=roots.map(n=>n.absoluteBoundingBox).filter(Boolean)
 if(boxes.length)anchor={page:figma.currentPage.id,x:Math.max(...boxes.map(b=>b.x+b.width))+64,y:Math.min(...boxes.map(b=>b.y))}
 post('materials',{items,grouped,groupName:roots.length===1?roots[0].name:'',key:JSON.stringify(roots.map(n=>n.id).sort())})
}
function frame(parent,name,x,y,w,h){
 const f=figma.createFrame();parent.appendChild(f);f.name=name;f.x=x;f.y=y;f.resize(w,h);f.fills=[];f.clipsContent=true;return f
}
async function reopen(){
 const root=figma.currentPage.selection[0]
 if(figma.currentPage.selection.length!==1||!root)throw Error('请选中一个Layout Desk生成的画板。')
 const parts=Number(root.getPluginData('deskParts'))
 if(!parts)throw Error('这个画板没有保存编辑记录。')
 let json=''
 for(let i=0;i<parts;i++)json+=root.getPluginData('desk'+i)
 const draft=JSON.parse(json)
 const hashes=new Set([draft.referenceHash,...draft.slots.map(s=>s.imageHash)].filter(Boolean))
 const images=[]
 for(const hash of hashes){
  const image=figma.getImageByHash(hash)
  if(!image)throw Error('画板中的图片记录已丢失。')
  images.push({hash,bytes:await image.getBytesAsync()})
 }
 if(figma.currentPage.selection[0]!==root)throw Error('选区已改变，请重新选择画板。')
 anchor={page:figma.currentPage.id,x:root.x+root.width+64,y:root.y}
 post('draft',{draft,images})
}
async function generate(m){
 const page=figma.currentPage
 const fonts=await figma.listAvailableFontsAsync()
 const getFont=s=> (fonts.find(f=>f.fontName.family===(s.family||(s.serif?'Georgia':'Inter'))&&f.fontName.style===(s.face||'Regular'))||fonts.find(f=>f.fontName.family==='Inter'&&f.fontName.style==='Regular')||fonts[0]).fontName
 const used=new Map()
 for(const s of m.slots.filter(s=>s.k==='text')){s.font=getFont(s);used.set(JSON.stringify(s.font),s.font)}
 for(const f of used.values())await figma.loadFontAsync(f)
 if(figma.currentPage!==page)throw Error('页面已切换，请重新生成。')
 const location=anchor&&anchor.page===page.id?anchor:{x:figma.viewport.center.x,y:figma.viewport.center.y}
 const root=frame(page,m.name,location.x,location.y,m.w,m.h)
 let overflow=0
 try{
  root.fills=paint(0xffffff)
  const referenceHash=figma.createImage(m.referenceBytes).hash
  const archive=figma.createRectangle();root.appendChild(archive)
  archive.name='Layout Desk · 编辑参考';archive.fills=[{type:'IMAGE',scaleMode:'FIT',imageHash:referenceHash}];archive.visible=false;archive.locked=true
  for(const s of m.slots){
   if(s.k==='line'){
    const l=figma.createLine();root.appendChild(l);l.resize(Math.max(.01,Math.hypot(s.w,s.h)),0);l.rotation=-Math.atan2(s.h,s.w)*180/Math.PI;l.x=s.x;l.y=s.y;l.strokes=paint(0xaaa7a0);l.name='连接线';continue
   }
   const f=frame(root,s.n,s.x,s.y,s.w,s.h)
   if(s.shape){f.strokes=paint(0xaaa7a0);f.cornerRadius=s.shape==='oval'?s.h/2:s.shape==='quote'?20:2;if(['box','quote'].includes(s.shape))f.fills=paint(0xf2efeb)}
   if(s.k==='image'){
    f.cornerRadius=s.radius||0
    if(!s.bytes){f.fills=paint(0xebece7);continue}
    s.imageHash=figma.createImage(s.bytes).hash
    const rect=figma.createRectangle();f.appendChild(rect);rect.resize(s.dw,s.dh);rect.x=s.dx;rect.y=s.dy;rect.name='照片 · 可移动裁切';rect.fills=[{type:'IMAGE',scaleMode:'FILL',imageHash:s.imageHash}];continue
   }
   const pad=s.shape?10:0
   const text=figma.createText();f.appendChild(text);text.name=s.n;text.fontName=s.font;text.characters=s.content||'';text.fontSize=s.fit;text.lineHeight={unit:'PERCENT',value:s.leading*100};text.fills=paint(0x202521)
   text.resize(Math.max(1,s.w-2*pad),1);text.textAutoResize='HEIGHT';text.x=pad;text.y=pad
   if(['box','oval','outline'].includes(s.shape)){text.textAlignHorizontal='CENTER';text.y=Math.max(pad,(s.h-text.height)/2)}
   if(text.characters && text.height>s.h-2*pad+1){overflow++;const dot=figma.createEllipse();root.appendChild(dot);dot.name='文字溢出 · '+s.n;dot.resize(8,8);dot.x=s.x+s.w-9;dot.y=s.y+1;dot.fills=paint(0xdb4438)}
  }
  const slots=m.slots.map(({bytes,asset,font,...slot})=>slot)
  const json=JSON.stringify({name:m.name,w:m.w,h:m.h,slots,referenceHash,source:m.source})
  const chunks=json.match(/[\s\S]{1,8000}/gu)||[]
  chunks.forEach((part,i)=>root.setPluginData('desk'+i,part));root.setPluginData('deskParts',String(chunks.length))
  page.selection=[root];figma.viewport.scrollAndZoomIntoView([root]);figma.commitUndo();anchor={page:page.id,x:root.x+root.width+64,y:root.y}
  post('status','已生成可编辑画板'+(overflow?'，'+overflow+' 处文字溢出已标红。':'。'))
 }catch(e){root.remove();throw e}
}
figma.ui.onmessage=async m=>{
 const root=figma.root
 if(m.type==='getCatalog'||m.type==='editCatalog'){
  const key=id=>'ldref_'+id
  const read=()=>{
   const hidden=[],saved=[]
   for(const k of root.getPluginDataKeys().filter(k=>/^ldref_(base-|public-)[a-z0-9-]+$/.test(k))){
    const id=k.slice(6),value=root.getPluginData(k)
    if(id.startsWith('base-'))hidden.push(id)
    else{
     let raw='';for(let i=0;i<Number(value);i++)raw+=root.getPluginData(k+'_'+i)
     saved.push({id,v:JSON.parse(raw)})
    }
   }
   return {hidden,saved}
  }
  const before=new Map()
  function write(k,value){if(!before.has(k))before.set(k,root.getPluginData(k));root.setPluginData(k,value)}
  try{
   if(m.type==='editCatalog')for(const change of m.data){
    const {id,visible,v}=change,k=key(id)
    if(!/^(base-|public-)[a-z0-9-]+$/.test(id))throw Error()
    if(id.startsWith('base-'))write(k,visible?'':'1')
    else if(visible&&!root.getPluginData(k)){
     const raw=JSON.stringify(v),count=Math.ceil(raw.length/16000)
     for(let i=0;i<count;i++)write(k+'_'+i,raw.slice(i*16000,(i+1)*16000))
     write(k,String(count))
    }else if(!visible){
     for(let i=0;i<Number(root.getPluginData(k));i++)write(k+'_'+i,'')
     write(k,'')
    }
   }
   post('catalogState',{state:read(),edited:m.type==='editCatalog'})
  }catch(e){for(const [k,value] of before)root.setPluginData(k,value);post('catalogFail',null)}
  return
 }

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
 if(m.type==='searchPinterest'){
  const query=typeof m.data==='string'?m.data.trim():''
  figma.openExternal(query?'https://www.pinterest.com/search/pins/?q='+encodeURIComponent(query):'https://www.pinterest.com/')
  return
 }
 if(m.type==='openProjectRepo'){
  if(githubRepository)figma.openExternal(githubRepository)
  return
 }

 if(m.type==='startPick'){picker={kind:m.data,initial:selectionKey(),batch:!m.data};figma.ui.resize(520,110);return}
 if(m.type==='pickBatch'){if(picker)picker.batch=m.data;return}
 if(m.type==='confirmPick'){await takePicked(true);return}
 if(m.type==='cancelPick'){if(picker)endPick();return}
 if(m.type==='initial')selectionInfo()
 if(m.type==='getCaptureKey'){post('captureKey',localCaptureKey||await figma.clientStorage.getAsync('capturePair')||'');return}
 if(m.type==='wakeCapture'){try{figma.openExternal('layoutdesk-capture://open')}catch(e){}return}
 if(m.type==='captureWindow'){
  if(m.data==='hide'){figma.ui.hide();return}
  figma.ui.show()
  if(m.data==='pair'){figma.ui.resize(440,128);return}
  if(m.data)figma.ui.resize(398,72)
  else figma.ui.resize(1000,690)
  return
 }
 if(busy)return
 busy=true
 try{if(m.type==='generate')await generate(m.data);else if(m.type==='resume')await reopen();else if(m.type!=='initial')await selection(m.type==='refSelection',m.data,m.type==='groupMaterials')}
 catch(e){post('status',String(e.message||e))}
 finally{busy=false;post('ready',true)}
}
