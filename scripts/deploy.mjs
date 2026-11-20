import { cp, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const git=(args,cwd=process.cwd())=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).trim();
const remote=git(['remote','get-url','origin']);
const author=git(['config','user.name']);
const email=git(['config','user.email']);
const staging=await mkdtemp(join(tmpdir(),'starlit-pages-'));
console.log('Preparing GitHub Pages build in '+staging);
git(['init','--initial-branch=gh-pages'],staging);
git(['config','user.name',author],staging);
git(['config','user.email',email],staging);
git(['remote','add','origin',remote],staging);
if(git(['ls-remote','--heads','origin','gh-pages'],staging)){
  git(['fetch','--depth=1','origin','gh-pages'],staging);
  git(['reset','--soft','FETCH_HEAD'],staging);
}
await cp('dist',staging,{recursive:true});
await writeFile(join(staging,'.nojekyll'),'');
git(['add','--all'],staging);
git(['commit','--allow-empty','-m','Deploy Christmas tree website'],staging);
git(['push','origin','HEAD:gh-pages'],staging);
console.log('Published build to the gh-pages branch.');
