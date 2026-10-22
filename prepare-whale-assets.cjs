// Slice the generated 3-column sprite sheet. Preserve transparency and artwork.
const path=require('node:path');
const sharp=require('sharp');
const source=path.join(__dirname,'artwork/whale-spritesheet.png');
(async()=>{
  const m=await sharp(source).metadata();
  if(!m.hasAlpha||m.width%3)throw Error('Expected a transparent three-column sheet');
  const cell=m.width/3;
  for(const [i,state]of ['idle','thinking','happy'].entries()){
    await sharp(source).extract({left:cell*i,top:0,width:cell,height:m.height}).resize(512,512,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png({compressionLevel:9}).toFile(path.join(__dirname,`extension/assets/whale-${state}.png`));
  }
  await sharp(source).extract({left:180,top:90,width:390,height:390}).resize(128,128).png().toFile(path.join(__dirname,'extension/assets/whale-avatar.png'));
  console.log(JSON.stringify({sheet:[m.width,m.height],hasAlpha:m.hasAlpha,states:3}));
})();
