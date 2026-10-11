import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

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
resource('wood',-1,7,0x995e2f,'🪵'); resource('wood',5,5,0x995e2f,'🪵'); resource('food',4,-4,0xd85e48,'🥕'); resource('food',7,-2,0xd8b342,'🥕'); resource('water',9,3,0x6b9bba,'💧'); resource('water',-11,5,0x6b9bba,'💧');

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
const inventory={wood:0,food:0,water:0};
let socket=null, currentRoom='', isMultiplayer=false, lastEmit=0, lastAction=0;
let joystick={x:0,y:0}, keys={};
function showToast(msg){ toastEl.textContent=msg; toastEl.classList.add('show'); clearTimeout(showToast.t); showToast.t=setTimeout(()=>toastEl.classList.remove('show'),1900); }
function setStatus(msg){statusEl.textContent=msg;}
function updateInventory(){ for(const k of Object.keys(inventory)) document.querySelector('#'+k+'Count').textContent=inventory[k]; }
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
  r.group.visible=false; inventory[r.type]++; updateInventory(); sendAction('resourceCollected',{type:r.type, index:resources.indexOf(r)}); showToast('Collected '+r.type+'!');
 } else if(action==='cook'){
  if(inventory.food>0&&inventory.wood>0){inventory.food--;inventory.wood--;updateInventory();showToast('🍲 Meal cooked! You both feel at home.');sendAction('cooked');}
  else showToast('Need 1 food + 1 wood to cook.');
 } else if(action==='home'){
  localPlayer.position.set(-7,0,-1.5); showToast('Back home 🏡'); sendPosition(true);
 } else if(action==='sleep'){
  if(localPlayer.position.distanceTo(new THREE.Vector3(-7,0,-4))>4.5){showToast('Go near your bed to sleep.');return;}
  localPlayer.rotation.x=-.15; showToast('🌙 Resting… sweet dreams!'); sendAction('sleep');
  setTimeout(()=>{localPlayer.rotation.x=0;showToast('Good morning! 🌤️');},1800);
 } else if(action==='wave'){
  localPlayer.rotation.z=.5; setTimeout(()=>localPlayer.rotation.z=0,500); showToast('👋 You waved hello!'); sendAction('wave');
 }
}
document.querySelector('#collectBtn').onclick=()=>performAction('collect');
document.querySelector('#cookBtn').onclick=()=>performAction('cook');
document.querySelector('#homeBtn').onclick=()=>performAction('home');
document.querySelector('#sleepBtn').onclick=()=>performAction('sleep');
document.querySelector('#waveBtn').onclick=()=>performAction('wave');

function connectServer(){
 const url=document.querySelector('#serverUrl').value.trim().replace(/\/$/,'');
 if(!url){showToast('Enter your deployed server URL first.');return;}
 if(!window.io){showToast('Socket.IO library did not load. Check internet.');return;}
 if(socket) socket.disconnect();
 socket=io(url,{transports:['websocket','polling'],timeout:8000});
 setStatus('Connecting…');
 socket.on('connect',()=>{setStatus('Server connected · create or join a room');roomInfo.textContent='Connected. Create a room or enter your friend's code.';});
 socket.on('connect_error',()=>{setStatus('Server unavailable');roomInfo.textContent='Could not connect. Check the server URL and make sure the backend is running.';});
 socket.on('disconnect',()=>{setStatus('Disconnected from server');isMultiplayer=false;});
 socket.on('roomCreated',({room,players})=>{currentRoom=room;isMultiplayer=true;document.querySelector('#roomCode').value=room;roomInfo.textContent='Room '+room+' created. Share this code with your friend.';setStatus('Multiplayer · room '+room);showToast('Room created: '+room);syncOtherPlayers(players||[]);});
 socket.on('roomJoined',({room,players})=>{currentRoom=room;isMultiplayer=true;roomInfo.textContent='Joined room '+room+'. You are playing together!';setStatus('Multiplayer · room '+room);showToast('Joined village!');syncOtherPlayers(players||[]);});
 socket.on('roomError',msg=>showToast(typeof msg==='string'?msg:'Room error'));
 socket.on('playerJoined',p=>{if(p.id!==socket.id)addOtherPlayer(p);roomInfo.textContent='Your friend joined the village!';});
 socket.on('playerLeft',id=>{if(otherPlayers.has(id)){scene.remove(otherPlayers.get(id).mesh);otherPlayers.delete(id);}});
 socket.on('playerMoved',p=>updateOtherPlayer(p));
 socket.on('gameAction',payload=>handleRemoteAction(payload));
 socket.on('state',state=>{if(state.inventory){Object.assign(inventory,state.inventory);updateInventory();} if(state.collected){state.collected.forEach(i=>{if(resources[i])resources[i].group.visible=false;});}});
}
document.querySelector('#saveServer').onclick=connectServer;
document.querySelector('#createRoom').onclick=()=>{if(!socket||!socket.connected){showToast('Connect to your multiplayer server first.');return;}socket.emit('createRoom');};
document.querySelector('#joinRoom').onclick=()=>{if(!socket||!socket.connected){showToast('Connect to your multiplayer server first.');return;}const code=document.querySelector('#roomCode').value.trim().toUpperCase();if(code.length<4){showToast('Enter a valid room code.');return;}socket.emit('joinRoom',code);};

function addOtherPlayer(p){
 if(otherPlayers.has(p.id))return;
 const mesh=makePlayer(0xc34f54,'Friend'); mesh.position.set(p.x||2,0,p.z||2);
 otherPlayers.set(p.id,{mesh});
}
function syncOtherPlayers(players){players.forEach(p=>{if(p.id!==socket?.id)addOtherPlayer(p);});}
function updateOtherPlayer(p){
 if(p.id===socket?.id)return;
 if(!otherPlayers.has(p.id))addOtherPlayer(p);
 const op=otherPlayers.get(p.id); op.mesh.position.set(p.x,0,p.z); op.mesh.rotation.y=p.rotation||0;
}
function sendPosition(force=false){
 if(!socket||!socket.connected||!currentRoom)return;
 const now=performance.now(); if(!force&&now-lastEmit<80)return; lastEmit=now;
 socket.emit('move',{room:currentRoom,x:localPlayer.position.x,z:localPlayer.position.z,rotation:localPlayer.rotation.y});
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
 const forward=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0)-joystick.y;
 const right=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)+joystick.x;
 const v=new THREE.Vector3(right,0,forward); if(v.length()>1)v.normalize();
 if(v.lengthSq()>0.001){
   const speed=4.2*dt; localPlayer.position.x+=v.x*speed;localPlayer.position.z-=v.z*speed;
   localPlayer.position.x=THREE.MathUtils.clamp(localPlayer.position.x,-31,31);
   localPlayer.position.z=THREE.MathUtils.clamp(localPlayer.position.z,-31,31);
   localPlayer.rotation.y=Math.atan2(v.x,-v.z);
   sendPosition();
 }
 camera.position.x=THREE.MathUtils.lerp(camera.position.x,localPlayer.position.x,dt*3);
 camera.position.z=THREE.MathUtils.lerp(camera.position.z,localPlayer.position.z+12,dt*3);
 camera.lookAt(localPlayer.position.x,0,localPlayer.position.z);
 // Day-night tint, slow gentle cycle
 const t=(performance.now()/1000)%120/120;
 const light=1.35+Math.sin(t*Math.PI*2)*.3; sun.intensity=light;
 renderer.render(scene,camera);
}
animate();
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));});
