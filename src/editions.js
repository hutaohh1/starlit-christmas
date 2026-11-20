const common = { exposure:1.05, ambient:.8, hemisphere:.9, key:2.1, fill:23, bloom:.52, bloomRadius:.42, bloomThreshold:1.08, count:34000, mobileCount:19000, snowColor:'#596761', starGlow:.36, starSize:1.45, starEmission:.75, ornaments:115, frameScale:.34, frameColor:'#a88a50', paperColor:'#aaa18e', cinematic:false, rays:true, stardust:true, groundGlow:.055 };
export const editions = {
  1: {...common,id:1,name:'初雪',exposure:1.2,ambient:1.1,hemisphere:1.4,key:3.5,fill:35,bloom:.72,bloomRadius:.55,bloomThreshold:.65,count:24000,mobileCount:14000,snowColor:'#c2c4b5',starGlow:.64,starSize:1.7,starEmission:1.2,ornaments:180,frameScale:.43,frameColor:'#c9aa69',paperColor:'#e8e1cf',rays:false,stardust:false,groundGlow:.2},
  2: {...common,id:2,name:'星芒'},
  3: {...common,id:3,name:'光影',exposure:1.08,ambient:.36,hemisphere:.55,key:1.55,fill:18,bloom:.65,bloomRadius:.58,bloomThreshold:.82,count:38000,mobileCount:21000,snowColor:'#87959b',starGlow:.39,starSize:1.9,starEmission:1.5,ornaments:95,frameScale:.3,cinematic:true,groundGlow:.075}
};
export const getEdition=id=>editions[id]||editions[3];
