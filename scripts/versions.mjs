import { readFile, writeFile } from 'node:fs/promises';
const main = await readFile('index.html','utf8');
for(const [version,name]of [[1,'初雪'],[2,'星芒'],[3,'光影']]){
  const html=main.replace('<body>','<body data-edition="'+version+'">').replace('<body data-edition="3">','<body data-edition="'+version+'">').replace('星愿圣诞 · A little Christmas magic','星愿圣诞 · '+name+'版 V'+version);
  await writeFile('version-'+version+'.html',html,'utf8');
}
console.log('三个版本页面已生成。');
