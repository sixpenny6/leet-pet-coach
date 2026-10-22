const path=require('node:path');
const sharp=require('sharp');
Promise.all([16,32,48,128].map(size=>sharp(path.join(__dirname,'extension/assets/whale-avatar.png')).resize(size,size).png().toFile(path.join(__dirname,`extension/icon${size}.png`)))).then(()=>console.log('Generated 4 whale-girl extension icons'));
