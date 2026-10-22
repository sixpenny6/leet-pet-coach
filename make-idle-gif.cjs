// Technical animation assembly from imagegen's open/closed-eye assets.
const path=require('node:path');
const sharp=require('sharp');
const dir=path.join(__dirname,'extension/assets');
(async()=>{
  const blink=await sharp(path.join(__dirname,'artwork/whale-blink-source.png')).resize(512,512,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  await sharp(blink).toFile(path.join(dir,'whale-blink.png'));
  const frames=[],delays=[],size=256,count=32;
  for(let i=0;i<count;i++){
    const phase=i/count*Math.PI*2,closed=i===21||i===22;
    const scale=224+Math.round(Math.sin(phase)*2),top=16+Math.round(Math.cos(phase)*2);
    const image=await sharp(closed?blink:path.join(dir,'whale-idle.png')).resize(scale,scale).png().toBuffer();
    const frame=await sharp({create:{width:size,height:size,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:image,left:Math.round((size-scale)/2),top}]).raw().toBuffer();
    frames.push(frame);delays.push(closed?80:160);
  }
  await sharp(Buffer.concat(frames),{raw:{width:size,height:size*count,channels:4,pageHeight:size}}).gif({loop:0,delay:delays,colours:128,effort:7,dither:0.4}).toFile(path.join(dir,'whale-idle.gif'));
  const meta=await sharp(path.join(dir,'whale-idle.gif'),{animated:true}).metadata();
  console.log(JSON.stringify({pages:meta.pages,pageHeight:meta.pageHeight,loop:meta.loop,hasAlpha:meta.hasAlpha}));
})();
