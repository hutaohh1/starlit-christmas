import{readFile,writeFile}from'node:fs/promises';
let html=await readFile('index.html','utf8');
const panel=`    <aside class="music-panel ui" id="music-panel" hidden aria-label="圣诞音乐">
      <div class="panel-heading"><div><span>Last Christmas</span><small>Taylor Swift · 默认循环播放</small></div><button class="icon-button small" id="close-music-panel" aria-label="收起音乐面板">×</button></div>
      <div id="official-music-player" class="official-player"></div>
      <p id="music-status" role="status">正在连接官方音乐…</p>
      <div class="music-controls"><button id="music-play-pause" class="text-button">播放</button><label for="music-volume">音量</label><input type="range" id="music-volume" min="0" max="100" value="35" aria-label="音乐音量" /></div>
      <div class="music-links"><a href="https://www.youtube.com/watch?v=NUZR_76Ruc4" target="_blank" rel="noopener noreferrer">官方音源 ↗</a><button id="local-music-button">选择本机歌曲</button></div>
      <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac" id="local-music-input" hidden />
    </aside>
`;
html=html.replace('    <aside class="settings-panel',panel+'    <aside class="settings-panel');
await writeFile('index.html',html);
let main=await readFile('src/main.js','utf8');
main=main.replace('const music=new ChristmasMusic();',`function musicState(state){
  const active=state==='playing';
  $('sound-button').innerHTML=icon(active?'sound':'mute');
  $('sound-button').setAttribute('aria-label',active?'暂停音乐':'播放 Last Christmas');
  $('sound-button').setAttribute('aria-pressed',String(active));
  $('sound-button').title=active?'暂停 Last Christmas':'播放 Last Christmas';
  $('music-play-pause').textContent=state==='loading'?'连接中…':active?'暂停':'播放';
  $('music-play-pause').disabled=state==='loading';
  const messages={loading:'正在连接官方音源，播放后自动循环。',playing:'正在播放 · 到结尾会自动从头播放',paused:'已暂停 · 点击播放继续',ready:'如果音乐尚未响起，点击播放器内的播放键。',error:'连接暂时不可用。可以打开官方音源，或选择本机歌曲。'};
  $('music-status').textContent=messages[state]||'';
}
const music=new ChristmasMusic({container:'official-music-player',onState:musicState,onError:error=>toast(error.message,6500)});`);
const start=main.indexOf("$('sound-button').addEventListener"),end=main.indexOf("$('upload-button').addEventListener",start);
main=main.slice(0,start)+`async function toggleMusic(){
  $('music-panel').hidden=false;toggleSettings(false);
  try{if(music.playing||music.pending)music.stop();else await music.start();}catch(error){toast(error.message,6500);}
}
$('sound-button').addEventListener('click',toggleMusic);
$('music-play-pause').addEventListener('click',toggleMusic);
$('close-music-panel').addEventListener('click',()=>{$('music-panel').hidden=true;});
$('music-volume').addEventListener('input',e=>music.setVolume(Number(e.target.value)));
$('local-music-button').addEventListener('click',()=>$('local-music-input').click());
$('local-music-input').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const name=await music.useLocalFile(file);$('official-music-player').hidden=true;$('music-status').textContent=name+' · 本机播放，默认循环';toast('歌曲已开始循环播放。');}catch(error){toast(error.message||'音频无法播放，请尝试 MP3 或 M4A 格式。');}e.target.value='';});
`+main.slice(end);
main=main.replace("function toggleSettings(force){const show=force??$('settings-panel').hidden;","function toggleSettings(force){const show=force??$('settings-panel').hidden;if(show)$('music-panel').hidden=true;");
await writeFile('src/main.js',main);
