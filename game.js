import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js';

const root = document.querySelector('#game');
const statusEl = document.querySelector('#status');
const roomInfo = document.querySelector('#roomInfo');
const toastEl = document.querySelector('#toast');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa9d5c2);
scene.fog = new THREE.Fog(0xa9d5c2, 32, 85);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .1, 150);
camera.position.set(0, 10, 13);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
root.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xeafcff, 0x68794b, 2.0));
const sun = new THREE.DirectionalLight(0xfff1ce, 2.2); sun.position.set(-8, 16, 9); scene.add(sun);

const mat = (color, roughness=1) => new THREE.MeshStandardMaterial({color, roughness});
const materials = {
 grass: mat(0x83b96d), path: mat(0xd5bd86), wall: mat(0xc99a65), roof: mat(0x8d4938),
 wood: mat(0x80512f), leaf: mat(0x3f8850), leaf2: mat(0x68a653), water: new THREE.MeshStandardMaterial({color:0x55b9c8,roughness:.25,metalness:.05}),
 stone: mat(0x8b9687), skin: mat(0xe6ad7d), cloth1: mat(0x386fbd), cloth2: mat(0xc34f54), dark: mat(0x382f2a), pot: mat(0x4c4540), fire: mat(0xff8b2c)
};
function box(name, x,y,z, sx,sy,sz, material, parent=scene) {
 const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz), material); mesh.name=name; mesh.position.set(x,y,z); parent.add(mesh); return mesh;
}
function sphere(name,x,y,z,r,material,parent=scene) {
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,12,10),material); mesh.name=name; mesh.position.set(x,y,z); parent.add(mesh); return mesh;
}
function cylinder(name,x,y,z,rt,rb,h,material,parent=scene) {
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,10),material); mesh.name=name; mesh.position.set(x,y,z); parent.add(mesh); return mesh;
}
// Ground and paths
box('grass',0,-.3,0,70,.5,70,materials.grass);
box('village path',0,-.025,3,3,.04,52,materials.path);
box('cross path',-1,-.02,-4,30,.04,2.3,materials.path);
const pond = new THREE.Mesh(new THREE.CylinderGeometry(5,5,.15,32),materials.water); pond.position.set(12,-.03,-12); scene.add(pond);
for(let i=0;i<18;i++){ const x=-28+(i*13%57), z=-28+(i*19%53); if(Math.abs(x)<5 && Math.abs(z)<6) continue; tree(x,z); }
function tree(x,z){
 cylinder('tree trunk',x,.8,z,.28,.38,1.6,materials.wood);
 sphere('tree leaves',x,2.0,z,.95,materials.leaf);
 sphere('tree leaves',x-.45,1.75,z+.18,.62,materials.leaf2);
 sphere('tree leaves',x+.42,1.78,z-.2,.62,materials.leaf);
}
// House
box('house body',-7,1.25,-3,6,2.5,5,materials.wall);
const roof1 = new THREE.Mesh(new THREE.ConeGeometry(4.35,2.1,4),materials.roof); roof1.rotation.y=Math.PI/4; roof1.position.set(-7,3.3,-3); scene.add(roof1);
box('door',-7,.72,-.47,1.05,1.45,.08,materials.wood);
box('window',-9,1.55,-.43,.85,.7,.08,materials.dark);
box('bed frame',-7, .38,-4,2.2,.25,1.2,materials.wood);
box('bed mattress',-7,.58,-4,2.05,.22,1.05,mat(0xe9d8b4));
box('pillow',-7,.73,-4.65,.65,.13,.38,mat(0xf5eee0));
// Outdoor cooking station
cylinder('clay stove',-2,.28,1,.75,.8,.55,materials.wall);
cylinder('cooking pot',-2,.72,1,.48,.5,.48,materials.pot);
cylinder('pot rim',-2,.98,1,.52,.52,.09,materials.stone);
sphere('fire glow',-2,.18,1,.3,materials.fire);
// Resource nodes
const resources=[];
function resource(type,x,z,color,emoji){
 const group=new THREE.Group(); group.position.set(x,0,z); scene.add(group);
 if(type==='wood'){ box('wood log',0,.22,0,.9,.32,.34,materials.wood,group); box('wood log',.12,.5,.05,.8,.28,.32,mat(0x9b683d),group); }
 if(type==='food'){ sphere('vegetable',0,.28,0,.32,mat(color),group); sphere('vegetable leaf',.06,.55,0,.2,materials.leaf,group); }
 if(type==='water'){ cylinder('water jar',0,.38,0,.3,.25,.7,mat(0x6b9bba),group); cylinder('jar mouth',0,.76,0,.16,.16,.1,materials.stone,group); }
 resources.push({type,group,emoji});
}
resource('wood',-1,7,0x995e2f,'🪵'); resource('wood',5,5,0x995e2f,'🪵');
// V3E adds extra shared wood nodes so building and furnishing are achievable.
resource('wood',16,-9,0x995e2f,'🪵'); resource('wood',28,-8,0x995e2f,'🪵'); resource('wood',17,5,0x995e2f,'🪵'); resource('wood',28,4,0x995e2f,'🪵');
resource('food',4,-4,0xd85e48,'🥕'); resource('food',7,-2,0xd8b342,'🥕'); resource('water',9,3,0x6b9bba,'💧'); resource('water',-11,5,0x6b9bba,'💧');

// V3C shared farm plots. The server is authoritative for crop state, seeds and coins.
const farmPlotPositions = [{x:-12,z:8},{x:-9,z:8},{x:-6,z:8},{x:-12,z:11},{x:-9,z:11},{x:-6,z:11}];
const farmPlotMeshes = farmPlotPositions.map((p,i)=>{
 const soil=box('farm soil '+(i+1),p.x,.015,p.z,2.25,.12,2.25,mat(0x795033));
 const border=box('farm border '+(i+1),p.x,.09,p.z,2.35,.08,2.35,mat(0xb99a69));
 const plantGroup=new THREE.Group(); plantGroup.position.set(p.x,0,p.z); scene.add(plantGroup);
 return {soil,border,plantGroup};
});
let sharedFarm = {coins:20,seeds:3,produce:0,crops:farmPlotPositions.map(()=>({stage:'empty',watered:false,readyAt:0}))};
function paintFarm(farm){
 if(!farm||!Array.isArray(farm.crops))return;
 sharedFarm={...sharedFarm,...farm};
 farmPlotMeshes.forEach((plot,i)=>{
  plot.plantGroup.clear();
  const crop=sharedFarm.crops[i]||{stage:'empty'};
  if(crop.stage==='seedling'||crop.stage==='growing'||crop.stage==='ready'){
   const height=crop.stage==='seedling'?.28:(crop.stage==='growing'?.62:.95);
   const stem=cylinder('crop stem',0,height/2,0,.08,.1,height,mat(0x438345),plot.plantGroup);
   sphere('crop leaf',-.18,height*.72,0,.2,mat(0x62a64b),plot.plantGroup);
   sphere('crop leaf',.18,height*.78,.03,.2,mat(0x4b943e),plot.plantGroup);
   if(crop.stage==='ready') sphere('ripe vegetable',0,height+.08,0,.25,mat(0xe6a63b),plot.plantGroup);
  }
 });
 updateFarmPanel();
 updateAnimalPanel();
 updateBuildingPanel();
 if(typeof updateMarketPanel==='function')updateMarketPanel();
}
const farmPanel=document.createElement('section');
farmPanel.id='farmPanel';
farmPanel.style.cssText='position:fixed;right:10px;top:58px;z-index:30;width:min(220px,48vw);max-height:48vh;overflow:auto;background:rgba(20,35,25,.9);color:#fff;border:1px solid #ffffff30;border-radius:14px;padding:10px;font:12px system-ui;box-shadow:0 5px 18px #0003;';
farmPanel.innerHTML='<div style="font-weight:800;font-size:14px;margin-bottom:5px">🌱 Shared Farm</div><div id="farmStats" style="line-height:1.6;margin-bottom:7px">20 coins · 3 seeds · 0 crops</div><div id="farmSelected" style="margin-bottom:7px;color:#d9e8c8">Move near a plot to farm</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px"><button data-farm="plant">Plant</button><button data-farm="water">Water</button><button data-farm="harvest">Harvest</button><button data-farm="buySeed">Buy seed · 5</button><button data-farm="sellProduce" style="grid-column:1/3">Sell all produce · 10 coins each</button></div><div style="font-size:10px;opacity:.8;margin-top:7px">Plant → water → wait 30 sec → harvest. Stand near a plot.</div>' ;
document.body.appendChild(farmPanel);
farmPanel.querySelectorAll('button').forEach(b=>{b.style.cssText='border:0;border-radius:8px;padding:9px 5px;background:#d8e8c6;color:#20351e;font-weight:700;font-size:11px;touch-action:manipulation';b.addEventListener('click',()=>farmAction(b.dataset.farm));});
function nearestFarmPlot(){let best=-1,d=999;farmPlotPositions.forEach((p,i)=>{const dist=Math.hypot(localPlayer.position.x-p.x,localPlayer.position.z-p.z);if(dist<d){d=dist;best=i;}});return d<=4.2?best:-1;}
function updateFarmPanel(){
 const stats=document.querySelector('#farmStats'),selected=document.querySelector('#farmSelected');
 if(stats)stats.textContent=`${sharedFarm.coins??20} shared coins · ${sharedFarm.seeds??3} seeds · ${sharedFarm.produce??0} harvested`;
 if(selected){const i=nearestFarmPlot();selected.textContent=i<0?'Move closer to a farm plot':`Plot ${i+1}: ${(sharedFarm.crops?.[i]?.stage||'empty').toUpperCase()}`;}
}
function farmAction(action){
 if(!socket||!socket.connected||!currentRoom){showToast('Join a multiplayer room to use the shared farm.');return;}
 const index=nearestFarmPlot();
 if(['plant','water','harvest'].includes(action)&&index<0){showToast('Move closer to one of the farm plots.');return;}
 socket.emit('farmAction',{room:currentRoom,action,index});
}


// V3D shared livestock pen. Animal inventory and transactions are server-authoritative.
const animalStallPositions = [{x:8,z:8},{x:11,z:8},{x:14,z:8},{x:8,z:12}];
const animalPen = new THREE.Group(); animalPen.name = 'shared livestock pen'; scene.add(animalPen);
// Simple low-poly fence with an open front so it remains easy to approach on mobile.
for (let x=7; x<=15; x+=2) { box('animal pen back post',x,.55,6.8,.16,1.1,.16,materials.wood,animalPen); }
box('animal pen back rail',11,.48,6.8,8.2,.12,.12,mat(0xc99a65),animalPen);
box('animal pen back rail upper',11,.86,6.8,8.2,.12,.12,mat(0xc99a65),animalPen);
for (let z=8; z<=12; z+=2) { box('animal pen left post',6.8,.55,z,.16,1.1,.16,materials.wood,animalPen); box('animal pen right post',15.2,.55,z,.16,1.1,.16,materials.wood,animalPen); }
box('animal pen left rail',6.8,.48,10,.12,.12,4.2,mat(0xc99a65),animalPen);
box('animal pen left rail upper',6.8,.86,10,.12,.12,4.2,mat(0xc99a65),animalPen);
box('animal pen right rail',15.2,.48,10,.12,.12,4.2,mat(0xc99a65),animalPen);
box('animal pen right rail upper',15.2,.86,10,.12,.12,4.2,mat(0xc99a65),animalPen);
const animalMeshes = animalStallPositions.map((p,i)=>{
 const pad=box('animal stall '+(i+1),p.x,.045,p.z,2.45,.08,2.45,mat(0xb8a078),animalPen);
 const group=new THREE.Group(); group.position.set(p.x,0,p.z); animalPen.add(group);
 return {pad,group};
});
let sharedLivestock={coins:20,feed:0,eggs:0,milk:0,goatMilk:0,stalls:animalStallPositions.map(()=>({type:'',fed:false,ready:false,readyAt:0}))};
function makeAnimalMesh(type,parent){
 const bodyColor=type==='cow'?0xf0ece0:(type==='goat'?0xd8c9a6:0xf4d7a0);
 const body=sphere('livestock body',0,.72,0,type==='chicken'?.32:.52,mat(bodyColor),parent);
 if(type==='chicken'){
  sphere('chicken head',.12,1.08,.08,.2,mat(0xf5e8c9),parent); sphere('chicken comb',.12,1.27,.08,.08,mat(0xc84b3d),parent);
  sphere('chicken beak',.3,1.06,.08,.07,mat(0xe3a52c),parent);
  for(const x of [-.16,.16]) cylinder('chicken leg',x,.23,0,.035,.035,.35,mat(0xb97a32),parent);
 } else {
  sphere('livestock head',0,1.02,.48,.28,mat(bodyColor),parent);
  sphere('livestock muzzle',0,.91,.7,.16,mat(type==='cow'?0xe8b9b4:0xcbb99b),parent);
  for(const x of [-.28,.28]) { cylinder('livestock leg',x,.28,0,.07,.08,.48,mat(0x665b4e),parent); }
  if(type==='cow') { sphere('cow patch',-.22,.84,.22,.17,mat(0x48423d),parent); sphere('cow patch',.24,.65,-.15,.15,mat(0x48423d),parent); }
  if(type==='goat') { cylinder('goat horn',-.14,1.34,.45,.025,.07,.24,mat(0x9d8c70),parent); cylinder('goat horn',.14,1.34,.45,.025,.07,.24,mat(0x9d8c70),parent); }
 }
}
function paintLivestock(state){
 if(!state||!Array.isArray(state.stalls))return;
 sharedLivestock={...sharedLivestock,...state};
 animalMeshes.forEach((slot,i)=>{
  slot.group.clear(); const animal=sharedLivestock.stalls[i]||{};
  if(animal.type) {
   makeAnimalMesh(animal.type,slot.group);
   if(animal.ready) sphere('product ready marker',0,1.65,0,.13,mat(0xffd34f),slot.group);
   else if(animal.fed) sphere('fed marker',0,1.52,0,.08,mat(0x69d6a1),slot.group);
  }
 });
 updateAnimalPanel();
 if(typeof updateMarketPanel==='function')updateMarketPanel();
}
const animalPanel=document.createElement('section'); animalPanel.id='animalPanel';
animalPanel.style.cssText='position:fixed;left:10px;top:58px;z-index:30;width:min(220px,48vw);max-height:48vh;overflow:auto;background:rgba(48,35,22,.92);color:#fff;border:1px solid #ffffff30;border-radius:14px;padding:10px;font:12px system-ui;box-shadow:0 5px 18px #0003;';
animalPanel.innerHTML='<div style="font-weight:800;font-size:14px;margin-bottom:5px">🐄 Shared Livestock</div><div id="animalStats" style="line-height:1.6;margin-bottom:7px">20 coins · 🥚 0 · 🥛 0</div><div id="animalSelected" style="margin-bottom:7px;color:#f1dfbb">Move near a stall</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px"><button data-animal="buyChicken">Buy chicken · 10</button><button data-animal="buyGoat">Buy goat · 25</button><button data-animal="buyCow">Buy cow · 30</button><button data-animal="feed">Feed · 2 coins</button><button data-animal="collect">Collect</button><button data-animal="sellProducts" style="grid-column:1/3">Sell all products · 8 coins each</button></div><div style="font-size:10px;opacity:.82;margin-top:7px">Buy → feed → wait 30 sec → collect. Stand near a stall. Products are shared.</div>';
document.body.appendChild(animalPanel);
animalPanel.querySelectorAll('button').forEach(b=>{b.style.cssText='border:0;border-radius:8px;padding:9px 4px;background:#f0dfbd;color:#44301e;font-weight:700;font-size:10px;touch-action:manipulation';b.addEventListener('click',()=>animalAction(b.dataset.animal));});
function nearestAnimalStall(){let best=-1,d=999;animalStallPositions.forEach((p,i)=>{const dist=Math.hypot(localPlayer.position.x-p.x,localPlayer.position.z-p.z);if(dist<d){d=dist;best=i;}});return d<=4.5?best:-1;}
function updateAnimalPanel(){
 const stats=document.querySelector('#animalStats'),selected=document.querySelector('#animalSelected');
 if(stats)stats.textContent=`${sharedLivestock.coins??sharedFarm.coins} shared coins · 🥚 ${sharedLivestock.eggs||0} · 🥛 ${(sharedLivestock.milk||0)+(sharedLivestock.goatMilk||0)}`;
 if(selected){const i=nearestAnimalStall(),a=i>=0?sharedLivestock.stalls?.[i]:null;selected.textContent=i<0?'Move closer to the animal pen':`Stall ${i+1}: ${a?.type?a.type.toUpperCase():'EMPTY'}${a?.ready?' · PRODUCT READY':a?.fed?' · resting':' '}`;}
}
function animalAction(action){
 if(!socket||!socket.connected||!currentRoom){showToast('Join a multiplayer room to manage shared livestock.');return;}
 const index=nearestAnimalStall();
 if(['buyChicken','buyGoat','buyCow','feed','collect'].includes(action)&&index<0){showToast('Move closer to an animal stall.');return;}
 socket.emit('animalAction',{room:currentRoom,action,index});
}


// V3E shared house construction and furniture. Mutations are validated by Render Socket.IO.
const buildSitePositions = [{x:19,z:-5},{x:25,z:-5},{x:22,z:2}];
const buildSiteMeshes = buildSitePositions.map((p,i)=>({
 pad:box('construction site '+(i+1),p.x,.035,p.z,4.8,.08,4.0,mat(0xb9a77c)),
 marker:box('construction marker '+(i+1),p.x,.12,p.z,1.0,.08,.16,mat(0xe6c96e))
}));
const buildingMeshes = buildSitePositions.map(()=>new THREE.Group());
buildingMeshes.forEach(g=>scene.add(g));
let sharedBuildings={sites:buildSitePositions.map(()=>({built:false,furniture:[]}))};
let buildingsSignature='';
function buildFurnitureMesh(type,x,z,parent){
 const wood=mat(0x80512f), cloth=mat(0xd9c6a0), dark=mat(0x59402e);
 if(type==='bed'){
  box('bed frame',x,.28,z,1.15,.22,.65,wood,parent);box('bed mattress',x,.43,z,1.08,.16,.58,cloth,parent);box('bed pillow',x,.55,z-.22,.3,.1,.2,mat(0xf4eee1),parent);
 } else if(type==='table'){
  box('table top',x,.68,z,.9,.14,.65,wood,parent);for(const dx of [-.34,.34])for(const dz of [-.22,.22])box('table leg',x+dx,.34,z+dz,.09,.6,.09,dark,parent);
 } else if(type==='chair'){
  box('chair seat',x,.42,z,.48,.12,.45,wood,parent);box('chair back',x,.72,z-.19,.48,.55,.1,wood,parent);for(const dx of [-.17,.17])for(const dz of [-.15,.15])box('chair leg',x+dx,.2,z+dz,.07,.4,.07,dark,parent);
 } else if(type==='chest'){
  box('storage chest',x,.32,z,.72,.52,.5,wood,parent);box('chest lid',x,.61,z,.76,.12,.54,mat(0xa87945),parent);box('chest latch',x,.45,z+.27,.1,.16,.04,mat(0xe3c26b),parent);
 }
}
function paintBuildings(state){
 if(!state||!Array.isArray(state.sites))return;
 const sig=JSON.stringify(state); sharedBuildings={...sharedBuildings,...state};
 if(sig===buildingsSignature){updateBuildingPanel();return;} buildingsSignature=sig;
 buildingMeshes.forEach((group,i)=>{
  buildSiteMeshes[i].pad.visible=!state.sites[i]?.built; buildSiteMeshes[i].marker.visible=!state.sites[i]?.built;
  while(group.children.length){const obj=group.children.pop();if(obj.geometry)obj.geometry.dispose();}
  const house=sharedBuildings.sites[i]||{};if(!house.built)return;
  const p=buildSitePositions[i];
  box('built house body',p.x,1.15,p.z,4.2,2.3,3.3,mat(0xc99a65),group);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(3.15,1.65,4),mat(0x8d4938));roof.rotation.y=Math.PI/4;roof.position.set(p.x,2.95,p.z);group.add(roof);
  box('house door',p.x,.68,p.z+1.68,.78,1.35,.08,mat(0x80512f),group);
  box('house window',p.x-1.25,1.45,p.z+1.69,.58,.5,.07,mat(0x382f2a),group);
  // Furniture stays within the house; the server stores only an allow-listed type and slot.
  const offsets=[[-1.15,-.75],[1.0,-.75],[-1.15,.65],[1.0,.65]];
  (house.furniture||[]).forEach(f=>{const o=offsets[f.slot];if(o&&['bed','table','chair','chest'].includes(f.type))buildFurnitureMesh(f.type,p.x+o[0],p.z+o[1],group);});
 });
 updateBuildingPanel();
}
const buildingPanel=document.createElement('section');buildingPanel.id='buildingPanel';
buildingPanel.style.cssText='position:fixed;right:10px;bottom:12px;z-index:31;width:min(224px,48vw);max-height:36vh;overflow:auto;background:rgba(49,36,25,.93);color:#fff;border:1px solid #ffffff30;border-radius:14px;padding:10px;font:12px system-ui;box-shadow:0 5px 18px #0003;';
buildingPanel.innerHTML='<div style="font-weight:800;font-size:14px;margin-bottom:5px">🏡 Houses & Furniture</div><div id="buildingStats" style="line-height:1.5;margin-bottom:6px">3 building sites · 0 houses</div><div id="buildingSelected" style="margin-bottom:7px;color:#f1dfbb">Move near a building site</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px"><button data-build="buildHouse">Build house · 8 coins + 3 wood</button><button data-build="bed">Place bed</button><button data-build="table">Place table</button><button data-build="chair">Place chair</button><button data-build="chest" style="grid-column:1/3">Place storage chest</button></div><div style="font-size:10px;opacity:.82;margin-top:7px">Gather wood, visit a marked site, then build. Furniture costs 3 coins + 1 wood each.</div>';
document.body.appendChild(buildingPanel);
buildingPanel.querySelectorAll('button').forEach(b=>{b.style.cssText='border:0;border-radius:8px;padding:9px 4px;background:#ead8b5;color:#44301e;font-weight:700;font-size:10px;touch-action:manipulation';b.addEventListener('click',()=>buildingAction(b.dataset.build));});
function nearestBuildSite(){let best=-1,d=999;buildSitePositions.forEach((p,i)=>{const dist=Math.hypot(localPlayer.position.x-p.x,localPlayer.position.z-p.z);if(dist<d){d=dist;best=i;}});return d<=5.5?best:-1;}
function updateBuildingPanel(){
 const stats=document.querySelector('#buildingStats'),selected=document.querySelector('#buildingSelected');
 if(stats){const built=(sharedBuildings.sites||[]).filter(h=>h.built).length;stats.textContent=`${built}/3 houses · ${inventory.wood||0} wood · ${sharedFarm.coins??20} shared coins`;}
 if(selected){const i=nearestBuildSite(),h=i>=0?sharedBuildings.sites?.[i]:null;selected.textContent=i<0?'Move near a marked building site':`Site ${i+1}: ${h?.built?'BUILT · '+(h.furniture?.length||0)+'/4 furniture':'EMPTY · needs 3 wood'}`;}
}
function buildingAction(action){
 if(!socket||!socket.connected||!currentRoom){showToast('Join a multiplayer room to build together.');return;}
 const index=nearestBuildSite();if(index<0){showToast('Move closer to a marked building site.');return;}
 if(action==='buildHouse')socket.emit('buildingAction',{room:currentRoom,action,index});
 else socket.emit('buildingAction',{room:currentRoom,action:'placeFurniture',index,type:action,slot:nearestFurnitureSlot(index)});
}
function nearestFurnitureSlot(index){const used=new Set((sharedBuildings.sites?.[index]?.furniture||[]).map(f=>f.slot));for(let i=0;i<4;i++)if(!used.has(i))return i;return -1;}


// V3F village market stall and touch-friendly shared trading panel.
const marketGroup = new THREE.Group(); scene.add(marketGroup);
box('market counter',0,.62,-10,4.4,1.15,1.2,mat(0x80512f),marketGroup);
box('market counter top',0,1.22,-10,4.7,.16,1.45,mat(0xc69a5b),marketGroup);
for(const x of [-1.85,1.85]) cylinder('market post',x,1.8,-10.45,.07,.07,1.35,mat(0x6c432b),marketGroup);
const marketCanopy=box('market canopy',0,2.48,-10.45,4.9,.22,1.65,mat(0xb84d3d),marketGroup);
marketCanopy.rotation.z=.02;
box('market sign',0,2.02,-9.25,2.0,.42,.08,mat(0xf0d6a0),marketGroup);
const marketPanel=document.createElement('section'); marketPanel.id='marketPanel';
marketPanel.style.cssText='position:fixed;left:10px;bottom:12px;z-index:32;width:min(220px,48vw);max-height:38vh;overflow:auto;background:rgba(36,42,32,.94);color:#fff;border:1px solid #ffffff30;border-radius:14px;padding:10px;font:12px system-ui;box-shadow:0 5px 18px #0003;';
marketPanel.innerHTML='<div style="font-weight:800;font-size:14px;margin-bottom:5px">🧺 Village Market</div><div id="marketStats" style="line-height:1.5;margin-bottom:7px">Shared coins · stock</div><div id="marketSelected" style="margin-bottom:7px;color:#f1dfbb">Move near the market stall</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px"><button data-market="buySeed">Seed · 5</button><button data-market="buyWood">Wood · 6</button><button data-market="buyFood">Food · 4</button><button data-market="buyWater">Water · 3</button><button data-market="sellProduce">Sell crops · 10 ea.</button><button data-market="sellEggs">Sell eggs · 8 ea.</button><button data-market="sellMilk">Sell cow milk · 8 ea.</button><button data-market="sellGoatMilk">Sell goat milk · 8 ea.</button></div><div style="font-size:10px;opacity:.82;margin-top:7px">Stand by the stall to trade. All prices and shared transactions are checked by the server.</div>';
document.body.appendChild(marketPanel);
marketPanel.querySelectorAll('button').forEach(b=>{b.style.cssText='border:0;border-radius:8px;padding:9px 4px;background:#ead8b5;color:#44301e;font-weight:700;font-size:10px;touch-action:manipulation';b.addEventListener('click',()=>marketAction(b.dataset.market));});
function nearMarket(){return Math.hypot(localPlayer.position.x,localPlayer.position.z+10)<=6;}
function updateMarketPanel(){
 const stats=document.querySelector('#marketStats'),selected=document.querySelector('#marketSelected');
 if(stats)stats.textContent=`${sharedFarm.coins??20} coins · 🌱 ${sharedFarm.seeds||0} seeds · 🌾 ${sharedFarm.produce||0} crops · 🥚 ${sharedLivestock.eggs||0} eggs · 🥛 ${(sharedLivestock.milk||0)+(sharedLivestock.goatMilk||0)} milk · 🪵 ${inventory.wood||0} wood`;
 if(selected)selected.textContent=nearMarket()?'Market stall: ready to trade':'Walk to the market stall (near the village centre)';
}
function marketAction(action){
 if(!socket||!socket.connected||!currentRoom){showToast('Join a multiplayer room to trade.');return;}
 if(!nearMarket()){showToast('Move closer to the village market.');return;}
 socket.emit('marketAction',{room:currentRoom,action});
}


function makePlayer(color, name) {
 const g=new THREE.Group();
 cylinder('body',0,1,0,.38,.43,1.0,mat(color),g);
 sphere('head',0,1.82,0,.36,materials.skin,g);
 sphere('hair',0,2.08,-.03,.37,materials.dark,g);
 box('armL',-.48,1.15,0,.18,.7,.2,mat(color),g);
 box('armR',.48,1.15,0,.18,.7,.2,mat(color),g);
 box('legL',-.19,.38,0,.2,.65,.23,materials.dark,g);
 box('legR',.19,.38,0,.2,.65,.23,materials.dark,g);
 // small floating name marker
 const canvas=document.createElement('canvas'); canvas.width=256; canvas.height=64;
 const ctx=canvas.getContext('2d'); ctx.fillStyle='rgba(17,40,27,.78)'; ctx.fillRect(4,4,248,56);
 ctx.fillStyle='white'; ctx.font='bold 24px sans-serif'; ctx.textAlign='center'; ctx.fillText(name,128,40);
 const tex=new THREE.CanvasTexture(canvas); const label=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true}));
 label.scale.set(2.1,.52,1); label.position.y=2.65; g.add(label);
 scene.add(g); return g;
}
const myId='p'+Math.random().toString(36).slice(2,8);
const localPlayer=makePlayer(0x386fbd,'You'); localPlayer.position.set(0,0,0);
const otherPlayers=new Map();
// V3B: villagers follow deterministic paths driven by the shared server clock.
let sharedWorldEpoch = Date.now();
let lastWorldClockSync = performance.now();
let greetedVillager = '';
const worldClockBadge = document.createElement('div');
worldClockBadge.id = 'worldClockBadge';
worldClockBadge.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:20;padding:7px 12px;border-radius:20px;background:rgba(20,35,25,.78);color:#fff;font:600 12px system-ui;pointer-events:none;box-shadow:0 2px 10px #0002;white-space:nowrap';
worldClockBadge.textContent = 'Village · Day';
document.body.appendChild(worldClockBadge);
const npcData = [
 {name:'Mina',color:0xd96b79,points:[[-4,2],[-1,4],[3,2],[2,-1],[-2,-2]],phase:0},
 {name:'Biren',color:0xd5a24a,points:[[4,7],[7,4],[5,1],[1,1],[0,5]],phase:17},
 {name:'Kaku',color:0x6e9dce,points:[[-12,-1],[-9,2],[-5,1],[-6,-4],[-10,-5]],phase:39}
];
const villagers = npcData.map((n,i)=>({ ...n, mesh:makePlayer(n.color,n.name), lastGreeting:false }));
for (const v of villagers) { v.mesh.position.set(v.points[0][0],0,v.points[0][1]); }
function getWorldSeconds(){ return sharedWorldEpoch/1000; }
function applyWorldClock(epoch){ if(Number.isFinite(Number(epoch))){sharedWorldEpoch=Number(epoch);lastWorldClockSync=performance.now();} }
function updateWorldClock(dt){
 // A complete village day lasts 8 real minutes. When online, the server supplies the clock.
 const epoch = isMultiplayer ? sharedWorldEpoch + Math.max(0,performance.now()-lastWorldClockSync) : Date.now();
 const daySeconds = 480, phase = ((epoch/1000)%daySeconds)/daySeconds;
 const angle = phase*Math.PI*2 - Math.PI/2;
 const daylight = THREE.MathUtils.clamp((Math.sin(angle)+0.18)/1.18,0,1);
 const night = 1-daylight;
 sun.intensity = 0.18 + daylight*2.0;
 sun.color.setRGB(1, 0.72+daylight*0.22, 0.48+daylight*0.42);
 scene.background.setRGB(0.035+daylight*0.62,0.06+daylight*0.70,0.13+daylight*0.60);
 scene.fog.color.copy(scene.background);
 worldClockBadge.textContent = (phase<0.20?'🌅 Dawn':phase<0.48?'☀️ Day':phase<0.62?'🌇 Sunset':'🌙 Night')+' · '+(isMultiplayer?'Shared village time':'Local time');
 // Smooth, repeatable walking loops mean every phone sees villagers in the same place.
 const seconds=epoch/1000;
 for(const v of villagers){
   const cycle=(seconds/13+v.phase/60)%v.points.length;
   const idx=Math.floor(cycle), frac=cycle-idx, a=v.points[idx], b=v.points[(idx+1)%v.points.length];
   const x=THREE.MathUtils.lerp(a[0],b[0],frac), z=THREE.MathUtils.lerp(a[1],b[1],frac);
   v.mesh.position.x=THREE.MathUtils.lerp(v.mesh.position.x,x,1-Math.exp(-dt*3));
   v.mesh.position.z=THREE.MathUtils.lerp(v.mesh.position.z,z,1-Math.exp(-dt*3));
   if(Math.hypot(b[0]-a[0],b[1]-a[1])>.01) v.mesh.rotation.y=Math.atan2(b[0]-a[0],-(b[1]-a[1]));
   v.mesh.position.y=Math.abs(Math.sin(seconds*5+v.phase))*.035;
 }
 const near=villagers.find(v=>Math.hypot(localPlayer.position.x-v.mesh.position.x,localPlayer.position.z-v.mesh.position.z)<2.2);
 if(near && greetedVillager!==near.name){greetedVillager=near.name;showToast(near.name+': Namaskar! Welcome to our village.');}
 if(!near)greetedVillager='';
}
const inventory={wood:0,food:0,water:0};
const needs={hunger:100,thirst:100,energy:100};
let meals=0, coins=0, villageLevel=1, questStage=0, lastNeedTick=performance.now(), lastNeedUi=0;
const quests=[
 {text:'Gather 2 wood, 2 food and 1 water.', done:()=>inventory.wood>=2&&inventory.food>=2&&inventory.water>=1},
 {text:'Cook a fresh meal at the village stove.', done:()=>meals>=1},
 {text:'Eat a meal to restore your hunger.', done:()=>ateMeal},
 {text:'Drink water to quench your thirst.', done:()=>drankWater},
 {text:'Sleep in your bed to finish the day.', done:()=>needs.energy>=90&&sleptToday}
];
let sleptToday=false, ateMeal=false, drankWater=false, questRewarded=false;
let socket=null, currentRoom='', isMultiplayer=false, lastEmit=0, lastAction=0;
let inviteRoomCode = new URLSearchParams(location.search).get('room')?.trim().toUpperCase() || '';
const inviteServerUrl = new URLSearchParams(location.search).get('server') || '';
const serverInput = document.querySelector('#serverUrl') || Object.assign(document.createElement('input'), { id: 'serverUrl', type: 'hidden', value: '' });
// Keep the technical server URL out of the player-facing Play Together panel.
const serverDetails = serverInput.closest('details');
if (serverDetails) serverDetails.remove();
serverInput.type = 'hidden';
if (!serverInput.isConnected) document.body.appendChild(serverInput);
try { serverInput.value = inviteServerUrl || localStorage.getItem('rannabatiServerUrl') || serverInput.value; } catch {}
function makeRoomLink(room) {
 const url = new URL(location.href); url.search = ''; url.hash = '';
 url.searchParams.set('room', room);
 const server = serverInput.value.trim().replace(/\/$/, '');
 if (server) url.searchParams.set('server', server);
 return url.href;
}
function showRoomShare(room) {
 const link = makeRoomLink(room);
 const shareBtn = document.querySelector('#shareRoom');
 shareBtn.disabled = false; shareBtn.dataset.link = link;
 document.querySelector('#roomInfo').textContent = `Room ${room} is ready. Share the invitation link with your friend.`;
}
function shareRoomWhatsApp() {
 const link = document.querySelector('#shareRoom').dataset.link;
 if (!currentRoom || !link) { showToast('Create or join a room first.'); return; }
 const message = `Join my Rannabati Village room (${currentRoom})\n${link}`;
 location.href = 'https://wa.me/?text=' + encodeURIComponent(message);
}
function copyRoomLink() {
 const link = document.querySelector('#shareRoom').dataset.link;
 if (!currentRoom || !link) { showToast('Create or join a room first.'); return; }
 if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(link).then(()=>showToast('Room link copied!')).catch(()=>prompt('Copy this room link:', link));
 else prompt('Copy this room link:', link);
}
let joystick={x:0,y:0}, keys={};
function showToast(msg){ toastEl.textContent=msg; toastEl.classList.add('show'); clearTimeout(showToast.t); showToast.t=setTimeout(()=>toastEl.classList.remove('show'),1900); }
function setStatus(msg){statusEl.textContent=msg;}
function updateInventory(){ for(const k of Object.keys(inventory)) {const el=document.querySelector('#'+k+'Count');if(el)el.textContent=inventory[k];} const mealEl=document.querySelector('#mealCount');if(mealEl)mealEl.textContent=meals; if(typeof updateBuildingPanel==='function')updateBuildingPanel(); if(typeof updateMarketPanel==='function')updateMarketPanel(); }
function updateNeeds(){
 for(const k of ['hunger','thirst','energy']){
  const val=Math.round(needs[k]); document.querySelector('#'+k+'Value').textContent=val+'%';
  document.querySelector('#'+k+'Bar').style.width=val+'%';
 }
 const q=quests[Math.min(questStage,quests.length-1)];
 document.querySelector('#questText').textContent=questStage>=quests.length?'Village tasks completed! Keep helping your village.':q.text;
 document.querySelector('#questBar').style.width=(questStage>=quests.length?100:(questStage/quests.length)*100)+'%';
 document.querySelector('#levelText').textContent='Village level '+villageLevel+' · '+coins+' coins';
}
function checkQuest(){
 if(questStage<quests.length&&quests[questStage].done()&&!questRewarded){
  questStage++; questRewarded=true; coins+=10*villageLevel; villageLevel++; showToast('🌟 Task complete! +'+(10*(villageLevel-1))+' coins · Village level '+villageLevel);
  setTimeout(()=>{questRewarded=false;updateNeeds();},500);
 }
 updateNeeds();
}
function nearestResource(){
 let nearest=null, d=999;
 for(const r of resources){ if(r.group.visible===false)continue; const dist=localPlayer.position.distanceTo(r.group.position); if(dist<2.25&&dist<d){nearest=r;d=dist;} }
 return nearest;
}
function sendAction(action,data={}){ if(socket&&socket.connected&&currentRoom) socket.emit('gameAction',{room:currentRoom,action,data}); }
function performAction(action){
 const now=Date.now(); if(now-lastAction<350)return; lastAction=now;
 if(action==='collect'){
  const r=nearestResource();
  if(!r){showToast('Move closer to wood, vegetables or water.');return;}
  r.group.visible=false; inventory[r.type]++; updateInventory(); sendAction('resourceCollected',{type:r.type,index:resources.indexOf(r)});
  if(r.type==='food') needs.hunger=Math.min(100,needs.hunger+3);
  showToast('Collected '+r.type+'!'); checkQuest();
 } else if(action==='cook'){
  if(inventory.food>0&&inventory.wood>0){inventory.food--;inventory.wood--;meals++;updateInventory();updateNeeds();showToast('🍲 Meal cooked! Tap Eat meal when hungry.');sendAction('cooked');checkQuest();}
  else showToast('Need 1 food + 1 wood to cook.');
 } else if(action==='eat'){
  if(meals>0){meals--;ateMeal=true;needs.hunger=Math.min(100,needs.hunger+42);needs.energy=Math.min(100,needs.energy+8);updateInventory();updateNeeds();showToast('🥣 Delicious! Hunger restored.');checkQuest();}
  else showToast('Cook a meal first.');
 } else if(action==='drink'){
  if(inventory.water>0){inventory.water--;drankWater=true;needs.thirst=Math.min(100,needs.thirst+48);updateInventory();updateNeeds();showToast('💧 Fresh water.');checkQuest();}
  else showToast('Collect water from a nearby jar first.');
 } else if(action==='home'){
  localPlayer.position.set(-7,0,-1.5); showToast('Back home 🏡'); sendPosition(true);
 } else if(action==='sleep'){
  if(localPlayer.position.distanceTo(new THREE.Vector3(-7,0,-4))>4.5){showToast('Go near your bed to sleep.');return;}
  localPlayer.rotation.x=-.15; sleptToday=true; needs.energy=100; needs.hunger=Math.max(0,needs.hunger-5); needs.thirst=Math.max(0,needs.thirst-4); updateNeeds();
  showToast('🌙 Resting… energy restored!'); sendAction('sleep'); checkQuest();
  setTimeout(()=>{localPlayer.rotation.x=0;showToast('Good morning! 🌤️');},1800);
 } else if(action==='wave'){
  localPlayer.rotation.z=.5; setTimeout(()=>localPlayer.rotation.z=0,500); showToast('👋 You waved hello!'); sendAction('wave');
 }
}
document.querySelector('#collectBtn').onclick=()=>performAction('collect');
document.querySelector('#cookBtn').onclick=()=>performAction('cook');
document.querySelector('#eatBtn').onclick=()=>performAction('eat');
document.querySelector('#drinkBtn').onclick=()=>performAction('drink');
document.querySelector('#homeBtn').onclick=()=>performAction('home');
document.querySelector('#sleepBtn').onclick=()=>performAction('sleep');
document.querySelector('#waveBtn').onclick=()=>performAction('wave');

function safeGet(key){try{return localStorage.getItem(key)||'';}catch{return '';}}
function safeSet(key,value){try{localStorage.setItem(key,value);}catch{}}

function connectServer(){
 const url=document.querySelector('#serverUrl').value.trim().replace(/\/$/,'');
 if(!url){setStatus('Multiplayer not configured');roomInfo.textContent='Multiplayer is not configured on this device yet.';showToast('Multiplayer is not configured yet.');return;}
 if(!window.io){setStatus('Socket.IO client unavailable');roomInfo.textContent='The multiplayer library could not load from the available CDNs. Offline village play should still work. Try another network or disable content blockers.';showToast('Multiplayer library unavailable');return;}
 try { localStorage.setItem('rannabatiServerUrl', url); } catch {}
 if(socket) socket.disconnect();
 socket=io(url,{transports:['websocket','polling'],timeout:15000,reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:1000,reconnectionDelayMax:8000,randomizationFactor:0.35});
 setStatus('Connecting to multiplayer server…');
 socket.on('connect',()=>{
   setStatus('Connected · syncing village…');
   const desiredRoom=inviteRoomCode || currentRoom || safeGet('rannabatiRoomCode');
   if(desiredRoom){inviteRoomCode='';document.querySelector('#roomCode').value=desiredRoom;roomInfo.textContent='Rejoining village '+desiredRoom+'…';socket.emit('joinRoom',desiredRoom);}
   else roomInfo.textContent="Connected. Create a room or enter your friend's code.";
 });
 socket.on('connect_error',err=>{setStatus('Retrying multiplayer connection…');roomInfo.textContent='Connection failed ('+(err&&err.message?err.message:'network error')+'). The game will keep retrying. Check your Render URL and internet connection.';});
 socket.on('reconnect_attempt',()=>setStatus('Reconnecting to multiplayer server…'));
 socket.on('disconnect',reason=>{setStatus('Disconnected · reconnecting…');isMultiplayer=false;roomInfo.textContent='Connection lost. Reconnecting automatically…';});
 socket.on('roomCreated',({room,players})=>{currentRoom=room;isMultiplayer=true;safeSet('rannabatiRoomCode',room);document.querySelector('#roomCode').value=room;showRoomShare(room);setStatus('Multiplayer · room '+room);showToast('Room created: '+room);syncOtherPlayers(players||[]);sendPosition(true);});
 socket.on('roomJoined',({room,players})=>{currentRoom=room;isMultiplayer=true;safeSet('rannabatiRoomCode',room);document.querySelector('#roomCode').value=room;showRoomShare(room);setStatus('Multiplayer · room '+room);roomInfo.textContent='Joined room '+room+'. Player positions are syncing.';showToast('Joined village!');syncOtherPlayers(players||[]);sendPosition(true);});
 socket.on('roomError',msg=>{setStatus('Multiplayer room error');roomInfo.textContent=typeof msg==='string'?msg:'Could not join this room.';showToast(typeof msg==='string'?msg:'Room error');});
 socket.on('playerJoined',p=>{if(p.id!==socket.id)addOtherPlayer(p);roomInfo.textContent='Your friend joined the village!';});
 socket.on('playerLeft',id=>{if(otherPlayers.has(id)){scene.remove(otherPlayers.get(id).mesh);otherPlayers.delete(id);}});
 socket.on('playerMoved',p=>updateOtherPlayer(p));
 socket.on('worldClock',payload=>{ if(payload&&payload.epoch) applyWorldClock(payload.epoch); });
 socket.on('gameAction',payload=>handleRemoteAction(payload));
 socket.on('state',state=>{if(state.inventory){Object.assign(inventory,state.inventory);updateInventory();updateNeeds();} if(state.collected){state.collected.forEach(i=>{if(resources[i])resources[i].group.visible=false;});} if(state.farm)paintFarm(state.farm);if(state.livestock)paintLivestock(state.livestock);if(state.buildings)paintBuildings(state.buildings);if(typeof updateMarketPanel==='function')updateMarketPanel();});
 socket.on('farmState',farm=>paintFarm(farm));
 socket.on('livestockState',livestock=>paintLivestock(livestock));
 socket.on('buildingsState',buildings=>paintBuildings(buildings));
 socket.on('buildingResult',result=>{if(result&&result.buildings)paintBuildings(result.buildings);if(result&&result.farm)paintFarm(result.farm);if(result&&result.inventory){Object.assign(inventory,result.inventory);updateInventory();}if(result&&result.message)showToast(result.message);});
 socket.on('marketResult',result=>{if(result&&result.state){if(result.state.inventory){Object.assign(inventory,result.state.inventory);updateInventory();}if(result.state.farm)paintFarm(result.state.farm);if(result.state.livestock)paintLivestock(result.state.livestock);}if(result&&result.message)showToast(result.message);});
 socket.on('animalResult',result=>{if(result&&result.farm)paintFarm(result.farm);if(result&&result.livestock)paintLivestock(result.livestock);if(result&&result.message)showToast(result.message);});
 socket.on('farmResult',result=>{if(result&&result.farm)paintFarm(result.farm);if(result&&result.message)showToast(result.message);});
}
const saveServerButton=document.querySelector('#saveServer'); if(saveServerButton) saveServerButton.onclick=connectServer;
document.querySelector('#shareRoom').onclick=shareRoomWhatsApp;
document.querySelector('#copyRoomLink').onclick=copyRoomLink;
document.querySelector('#toggleRoomPanel').onclick=()=>{const panel=document.querySelector('.room-panel');const collapsed=panel.classList.toggle('collapsed');document.querySelector('#toggleRoomPanel').textContent=collapsed?'＋':'−';document.querySelector('#toggleRoomPanel').setAttribute('aria-expanded',String(!collapsed));};
document.querySelector('#createRoom').onclick=()=>{if(!socket||!socket.connected){showToast('Connect to your multiplayer server first.');return;}socket.emit('createRoom');};
document.querySelector('#joinRoom').onclick=()=>{if(!socket||!socket.connected){showToast('Connect to your multiplayer server first.');return;}const code=document.querySelector('#roomCode').value.trim().toUpperCase();if(code.length<4){showToast('Enter a valid room code.');return;}socket.emit('joinRoom',code);};
if(serverInput.value.trim()) { setStatus('Connecting to village…'); connectServer(); }

function addOtherPlayer(p){
 if(!p||!p.id||p.id===socket?.id)return;
 if(otherPlayers.has(p.id))return;
 const mesh=makePlayer(0xc34f54,'Friend');
 const x=Number.isFinite(Number(p.x))?Number(p.x):2, z=Number.isFinite(Number(p.z))?Number(p.z):2;
 mesh.position.set(x,0,z);
 otherPlayers.set(p.id,{mesh,targetX:x,targetZ:z,targetRotation:Number(p.rotation)||0,lastSeen:performance.now()});
}
function syncOtherPlayers(players){
 const present=new Set();
 players.forEach(p=>{if(p.id!==socket?.id){present.add(p.id);updateOtherPlayer(p);}});
 for(const [id,op] of otherPlayers){if(!present.has(id)){scene.remove(op.mesh);otherPlayers.delete(id);}}
}
function updateOtherPlayer(p){
 if(!p||p.id===socket?.id||!Number.isFinite(Number(p.x))||!Number.isFinite(Number(p.z)))return;
 if(!otherPlayers.has(p.id))addOtherPlayer(p);
 const op=otherPlayers.get(p.id); if(!op)return;
 op.targetX=THREE.MathUtils.clamp(Number(p.x),-31,31); op.targetZ=THREE.MathUtils.clamp(Number(p.z),-31,31); op.targetRotation=Number(p.rotation)||0; op.lastSeen=performance.now();
}
function sendPosition(force=false){
 if(!socket||!socket.connected||!currentRoom)return;
 const now=performance.now(); if(!force&&now-lastEmit<100)return; lastEmit=now;
 socket.emit('move',{room:currentRoom,x:localPlayer.position.x,z:localPlayer.position.z,rotation:localPlayer.rotation.y,ts:Math.round(now)});
}
function interpolateRemotePlayers(dt){
 const blend=1-Math.exp(-Math.min(dt,.05)*12);
 for(const [id,op] of otherPlayers){
   op.mesh.position.x=THREE.MathUtils.lerp(op.mesh.position.x,op.targetX,blend);
   op.mesh.position.z=THREE.MathUtils.lerp(op.mesh.position.z,op.targetZ,blend);
   let delta=((op.targetRotation-op.mesh.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;
   op.mesh.rotation.y+=delta*blend;
 }
}
function handleRemoteAction(p){
 if(!p||!p.action)return;
 if(p.action==='resourceCollected'&&p.data&&resources[p.data.index])resources[p.data.index].group.visible=false;
 if(p.action==='cooked')showToast('🍲 Your partner cooked a meal!');
 if(p.action==='sleep')showToast('🌙 Your partner is resting.');
 if(p.action==='wave')showToast('👋 Your partner waved at you!');
 if(p.action==='resourceCollected')showToast('Your partner collected '+p.data.type+'.');
}
window.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();});
window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
// Touch joystick
const joy=document.querySelector('#joystick'), stick=document.querySelector('#stick'); let joyPointer=null;
function moveStick(e){
 const r=joy.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
 let dx=e.clientX-cx, dy=e.clientY-cy, max=34, len=Math.hypot(dx,dy);
 if(len>max){dx=dx/len*max;dy=dy/len*max;}
 joystick.x=dx/max; joystick.y=dy/max; stick.style.transform=`translate(${dx}px,${dy}px)`;
}
joy.addEventListener('pointerdown',e=>{joyPointer=e.pointerId;joy.setPointerCapture(joyPointer);moveStick(e);});
joy.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)moveStick(e);});
function resetJoy(){joyPointer=null;joystick.x=joystick.y=0;stick.style.transform='translate(0,0)';}
joy.addEventListener('pointerup',resetJoy);joy.addEventListener('pointercancel',resetJoy);

const clock=new THREE.Clock();
function animate(){
 requestAnimationFrame(animate);
 const dt=Math.min(clock.getDelta(),.05);
 interpolateRemotePlayers(dt);
 const now=performance.now();
 if(now-lastNeedTick>18000){const ticks=Math.floor((now-lastNeedTick)/18000);lastNeedTick+=ticks*18000;needs.hunger=Math.max(0,needs.hunger-ticks*1.2);needs.thirst=Math.max(0,needs.thirst-ticks*1.8);needs.energy=Math.max(0,needs.energy-ticks*.65);}
 if(now-lastNeedUi>700){lastNeedUi=now;updateNeeds();}
 const forward=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0)-joystick.y;
 const right=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)+joystick.x;
 const v=new THREE.Vector3(right,0,forward); if(v.length()>1)v.normalize();
 if(v.lengthSq()>0.001){
   const needsFactor=(needs.hunger<15||needs.thirst<15)?0.62:(needs.energy<15?0.75:1); const speed=4.2*needsFactor*dt; needs.energy=Math.max(0,needs.energy-dt*.12); localPlayer.position.x+=v.x*speed;localPlayer.position.z-=v.z*speed;
   localPlayer.position.x=THREE.MathUtils.clamp(localPlayer.position.x,-31,31);
   localPlayer.position.z=THREE.MathUtils.clamp(localPlayer.position.z,-31,31);
   localPlayer.rotation.y=Math.atan2(v.x,-v.z);
   sendPosition();
 }
 camera.position.x=THREE.MathUtils.lerp(camera.position.x,localPlayer.position.x,dt*3);
 camera.position.z=THREE.MathUtils.lerp(camera.position.z,localPlayer.position.z+12,dt*3);
 camera.lookAt(localPlayer.position.x,0,localPlayer.position.z);
 updateWorldClock(dt);
 if(Math.floor(now/400)!==Math.floor((now-dt*1000)/400)){updateFarmPanel();updateAnimalPanel();updateBuildingPanel();updateMarketPanel();}
 renderer.render(scene,camera);
}
// V3G compact mobile UI: one contextual drawer instead of four overlapping panels.
(function installCompactVillageUI(){
 const panels=[
  {id:'farmPanel',label:'Farm',icon:'🌱'},
  {id:'animalPanel',label:'Animals',icon:'🐄'},
  {id:'buildingPanel',label:'Build',icon:'🏡'},
  {id:'marketPanel',label:'Market',icon:'🧺'}
 ];
 const style=document.createElement('style');
 style.textContent=`
  #villageDock{position:fixed;z-index:80;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));margin:auto;width:min(430px,calc(100vw - 16px));font:14px system-ui,-apple-system,sans-serif;color:#fff;pointer-events:none}
  #villageDock *{box-sizing:border-box}
  #villageTabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;padding:6px;background:rgba(25,39,29,.94);border:1px solid #ffffff30;border-radius:17px;box-shadow:0 4px 18px #0003;pointer-events:auto;backdrop-filter:blur(8px)}
  #villageTabs button{min-width:0;border:0;border-radius:11px;padding:9px 2px;background:transparent;color:#e7e9df;font:600 11px system-ui;touch-action:manipulation}
  #villageTabs button.active{background:#f1cc7a;color:#2d3324}
  #villageDrawer{display:none;margin-bottom:7px;max-height:min(36dvh,300px);overflow:auto;padding:12px;background:rgba(25,39,29,.96);border:1px solid #ffffff30;border-radius:17px;box-shadow:0 4px 20px #0004;pointer-events:auto;backdrop-filter:blur(10px)}
  #villageDrawer.open{display:block}
  #villageDrawer>section{position:static!important;inset:auto!important;width:100%!important;max-width:none!important;max-height:none!important;overflow:visible!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;font:13px system-ui!important;color:#fff!important}
  #villageDrawer section>div:first-child{font-size:16px!important;margin:0 0 8px!important}
  #villageDrawer section [id$="Stats"]{font-size:12px!important;color:#e9e6d8;line-height:1.55!important}
  #villageDrawer section [id$="Selected"]{font-size:12px!important;line-height:1.4;margin:5px 0 9px!important;color:#f1d99e!important}
  #villageDrawer section button{min-height:42px!important;padding:9px 7px!important;border-radius:11px!important;font-size:12px!important;line-height:1.2!important;box-shadow:0 1px 0 #0001}
  #villageDrawer section>div:last-child{font-size:11px!important;line-height:1.35;margin-top:8px!important;color:#d6d9cc}
  #villageDock .village-drawer-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-weight:750}
  #villageDock #villageClose{border:0;background:#ffffff18;color:#fff;border-radius:9px;min-width:32px;min-height:30px;font-size:18px}
  @media(max-width:600px){#villageDock{bottom:calc(6px + env(safe-area-inset-bottom));left:6px;right:6px;width:calc(100vw - 12px)}#villageDrawer{max-height:min(34dvh,270px);padding:10px}#villageTabs{gap:3px;padding:4px;border-radius:14px}#villageTabs button{font-size:10px;padding:7px 1px;min-height:50px}#villageTabs button span{font-size:15px!important}#villageDrawer section button{min-height:44px!important;font-size:12px!important}}
  html,body{margin:0;width:100%;height:100%;overflow:hidden;overscroll-behavior:none;touch-action:manipulation}canvas{display:block;max-width:100vw;max-height:100dvh}#villageFullscreen{position:fixed;top:calc(8px + env(safe-area-inset-top));right:8px;z-index:100;border:1px solid #ffffff35;border-radius:12px;padding:9px 11px;background:rgba(25,39,29,.88);color:#fff;font:600 12px system-ui;box-shadow:0 2px 10px #0003;touch-action:manipulation}body:fullscreen #villageFullscreen{top:8px}body:fullscreen #villageDock{bottom:calc(6px + env(safe-area-inset-bottom))} @media(orientation:landscape) and (max-height:500px){#villageDrawer{max-height:42dvh}#villageTabs button{min-height:40px;padding:4px 1px}#villageFullscreen{padding:6px 8px}}
 `;
 document.head.appendChild(style);
 // Fullscreen is user-initiated; request landscape orientation on supported mobile browsers.
 const fullscreenBtn=document.createElement('button');fullscreenBtn.id='villageFullscreen';fullscreenBtn.type='button';fullscreenBtn.textContent='⛶ Fullscreen';fullscreenBtn.setAttribute('aria-label','Open game in fullscreen and rotate to landscape');document.body.appendChild(fullscreenBtn);
 async function toggleGameFullscreen(){try{if(!document.fullscreenElement){await (document.documentElement.requestFullscreen?document.documentElement.requestFullscreen():Promise.reject());fullscreenBtn.textContent='⤢ Exit full';if(screen.orientation&&screen.orientation.lock){try{await screen.orientation.lock('landscape')}catch(_){}}}else{await document.exitFullscreen();fullscreenBtn.textContent='⛶ Fullscreen'}}catch(_){fullscreenBtn.textContent='Fullscreen unavailable';setTimeout(()=>{fullscreenBtn.textContent='⛶ Fullscreen'},1800)}}
 fullscreenBtn.addEventListener('click',toggleGameFullscreen);document.addEventListener('fullscreenchange',()=>{fullscreenBtn.textContent=document.fullscreenElement?'⤢ Exit full':'⛶ Fullscreen';window.dispatchEvent(new Event('resize'));});
 const dock=document.createElement('div');dock.id='villageDock';
 const drawer=document.createElement('div');drawer.id='villageDrawer';
 const head=document.createElement('div');head.className='village-drawer-head';
 head.innerHTML='<span id="villageDrawerTitle">🌱 Farm</span><button id="villageClose" aria-label="Close actions">×</button>';
 drawer.appendChild(head);
 const tabs=document.createElement('div');tabs.id='villageTabs';
 const tabButtons=[];let activeId='farmPanel',opened=false;
 panels.forEach(item=>{
  const panel=document.getElementById(item.id);if(!panel)return;
  drawer.appendChild(panel);
  const btn=document.createElement('button');btn.type='button';btn.innerHTML=`<span style="display:block;font-size:17px;margin-bottom:2px">${item.icon}</span>${item.label}`;
  btn.setAttribute('aria-label',item.label);btn.addEventListener('click',()=>{if(activeId===item.id&&opened){setOpen(false);return;}activeId=item.id;setOpen(true);});
  tabs.appendChild(btn);tabButtons.push({btn,item});
 });
 dock.append(drawer,tabs);document.body.appendChild(dock);
 function setOpen(value){opened=value;drawer.classList.toggle('open',opened);tabButtons.forEach(({btn,item})=>{btn.classList.toggle('active',item.id===activeId);btn.setAttribute('aria-pressed',String(item.id===activeId&&opened));const panel=document.getElementById(item.id);if(panel)panel.style.display=(opened&&item.id===activeId)?'block':'none';});const item=panels.find(p=>p.id===activeId)||panels[0];document.querySelector('#villageDrawerTitle').textContent=item.icon+' '+item.label;}
 document.querySelector('#villageClose').addEventListener('click',()=>setOpen(false));
 // Start collapsed so the world remains visible; first tab tap opens its actions.
 setOpen(false);
})();

updateInventory(); updateNeeds(); paintFarm(sharedFarm); paintBuildings(sharedBuildings); updateMarketPanel();
animate();
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));});
