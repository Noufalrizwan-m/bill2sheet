import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// All joints and sheets share one world-space timeline; release never teleports.
export async function createPaperTossScene(canvas, onComplete, signal) {
  const data=await fetch('/models/hand-right.glb',{signal}).then(r=>{if(!r.ok)throw new Error('Hand unavailable');return r.arrayBuffer();});
  const asset=await new GLTFLoader().parseAsync(data,'');
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000,0);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(38,1,.1,50);
  camera.position.set(0,1,8);camera.lookAt(0,.65,0);
  scene.add(new THREE.HemisphereLight(0xfff5e5,0xc4b5a4,2.1));
  const key=new THREE.DirectionalLight(0xffe4c8,2.4);key.position.set(-3,5,5);scene.add(key);
  const rim=new THREE.DirectionalLight(0xffffff,2);rim.position.set(4,2,-3);scene.add(rim);
  const skin=new THREE.MeshPhysicalMaterial({color:0xb87955,roughness:.78,metalness:0,clearcoat:.015});
  const cloth=new THREE.MeshStandardMaterial({color:0x243c4b,roughness:.95});
  const cuff=new THREE.MeshStandardMaterial({color:0xfaf5e8,roughness:.8});
  const arm=new THREE.Group();scene.add(arm);
  const wrist=new THREE.Group();arm.add(wrist);
  const model=asset.scene;
  model.updateMatrixWorld(true);
  const root=model.getObjectByName('wrist');
  const animated=[];
  // The WebXR asset stores joints as siblings. Reparent while preserving the
  // bind pose to obtain conventional articulated finger chains.
  for(const finger of ['thumb','index-finger','middle-finger','ring-finger','pinky-finger']){
    const suffixes=finger==='thumb'?['metacarpal','phalanx-proximal','phalanx-distal','tip']:['metacarpal','phalanx-proximal','phalanx-intermediate','phalanx-distal','tip'];
    let parent=root;
    for(const suffix of suffixes){
      const bone=model.getObjectByName(`${finger}-${suffix}`);
      parent.attach(bone);
      const world=bone.getWorldQuaternion(new THREE.Quaternion());
      const axis=new THREE.Vector3(0,0,1).applyQuaternion(world.invert()).normalize();
      animated.push({bone,rest:bone.quaternion.clone(),axis,finger,suffix});
      parent=bone;
    }
  }
  model.traverse(o=>{if(o.isMesh){o.material.dispose();o.material=skin;o.frustumCulled=false;}});
  const orientation=new THREE.Group();orientation.scale.setScalar(9);
  orientation.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,1),new THREE.Vector3(0,-1,0),new THREE.Vector3(1,0,0)));
  model.position.copy(root.position).negate();orientation.add(model);orientation.position.y=-.5;wrist.add(orientation);
  const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(.27,.38,1.6,40),cloth);sleeve.position.y=-1.4;wrist.add(sleeve);
  const shirt=new THREE.Mesh(new THREE.CylinderGeometry(.25,.28,.2,40),cuff);shirt.position.y=-.53;wrist.add(shirt);

  const paperCanvas=document.createElement('canvas');paperCanvas.width=384;paperCanvas.height=512;
  const ctx=paperCanvas.getContext('2d');ctx.fillStyle='#fffdf5';ctx.fillRect(0,0,384,512);
  ctx.fillStyle='#243c4b';ctx.font='bold 22px sans-serif';ctx.fillText('PAYMENT VOUCHER',30,52);
  ctx.strokeStyle='#b8bdb5';ctx.lineWidth=2;
  for(let y=90;y<250;y+=37){ctx.beginPath();ctx.moveTo(30,y);ctx.lineTo(354,y);ctx.stroke();}
  ctx.font='italic 32px Georgia';ctx.fillStyle='#ae4c38';ctx.fillText('Check again!',50,295);
  for(let y=340;y<=460;y+=30){ctx.beginPath();ctx.moveTo(30,y);ctx.lineTo(354,y);ctx.stroke();}
  for(let x=30;x<=354;x+=108){ctx.beginPath();ctx.moveTo(x,340);ctx.lineTo(x,460);ctx.stroke();}
  const texture=new THREE.CanvasTexture(paperCanvas);texture.colorSpace=THREE.SRGBColorSpace;
  const paperMaterial=new THREE.MeshStandardMaterial({map:texture,side:THREE.DoubleSide,roughness:.85,color:0xfffcf2,emissive:0xede7dc,emissiveIntensity:.18});
  const sheets=[];
  for(let i=0;i<8;i++){
    const geometry=new THREE.PlaneGeometry(.92,1.24,12,16);
    const positions=geometry.attributes.position;
    for(let j=0;j<positions.count;j++)positions.setZ(j,.055*Math.pow(positions.getX(j)*2,2));
    geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,paperMaterial);mesh.position.set(.04+i*.004,1.12+i*.004,.48+i*.006);wrist.add(mesh);
    sheets.push({mesh,index:i,released:false,origin:new THREE.Vector3(),rotation:new THREE.Quaternion()});
  }
  const resize=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.z=w/h<.7?10:8;camera.updateProjectionMatrix();};
  resize();window.addEventListener('resize',resize);
  const smooth=(a,b,t)=>{const v=THREE.MathUtils.clamp((t-a)/(b-a),0,1);return v*v*(3-2*v);};
  function pose(t){
    const enter=smooth(0,.45,t),pull=smooth(.5,1.05,t),flick=smooth(1.05,1.48,t),away=smooth(2.1,3.4,t);
    arm.position.set(-.35+.3*flick,-2.8+1.65*enter-.28*pull+.55*flick-2.7*away,0);
    arm.rotation.set(-.12, -.32, .18+.32*pull-.72*flick+.25*away);
    wrist.rotation.x=-.12-.5*pull+.9*flick;
    wrist.rotation.z=.1-.22*flick;
    const release=smooth(1.22,1.55,t);
    for(const {bone,rest,axis,finger,suffix} of animated){
      const weight=suffix==='metacarpal'?.05:suffix==='phalanx-proximal'?.8:suffix==='phalanx-intermediate'?1.1:suffix==='phalanx-distal'?.65:0;
      bone.quaternion.copy(rest).multiply(new THREE.Quaternion().setFromAxisAngle(axis,weight*(1-release)*(finger==='thumb'?.65:1)));
    }
  }
  let started;
  renderer.setAnimationLoop(now=>{
    started??=now;const t=(now-started)/1000;pose(t);scene.updateMatrixWorld(true);
    for(const sheet of sheets){const {mesh,index:i}=sheet;const launch=1.33+i*.018;
      if(t>=launch&&!sheet.released){scene.attach(mesh);sheet.origin.copy(mesh.position);sheet.rotation.copy(mesh.quaternion);sheet.released=true;}
      if(sheet.released){const dt=t-launch;const spread=(i-3.5)*.57;mesh.position.copy(sheet.origin).add(new THREE.Vector3(spread*dt,(3.3+(i%3)*.35)*dt-1.5*dt*dt,((i%3)-1)*.65*dt));mesh.quaternion.copy(sheet.rotation);mesh.rotateX(dt*(.8+i*.16));mesh.rotateY(Math.sin(dt*5+i)*.3*dt);mesh.rotateZ(dt*spread*.6);}
    }
    renderer.render(scene,camera);
    if(t>3.65){renderer.setAnimationLoop(null);onComplete();}
  });
  return ()=>{renderer.setAnimationLoop(null);window.removeEventListener('resize',resize);const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());texture.dispose();renderer.dispose();};
}
