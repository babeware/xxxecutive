const {app, BrowserWindow, ipcMain, shell, dialog} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const crypto = require('crypto');
const {pipeline} = require('stream/promises');
const {Transform} = require('stream');

app.setName('XXXECUTIVE');
if (process.platform === 'win32') app.setAppUserModelId('com.babeware.xxxecutive');
const VERSION = app.getVersion();
const MAX_MANIFEST = 256 * 1024;
const MAX_INSTALLER = 600 * 1024 * 1024;
let win;
let latest = null;
let busy = false;
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'update-config.json'), 'utf8'));
const MANIFEST_URL = config.manifest_url;

function emit(kind, message, extra = {}) {
  if (win && !win.isDestroyed()) win.webContents.send('updates:status', {kind, message, ...extra});
}
function allowedURL(value, type) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('HTTPS URL required');
  const host = url.hostname.toLowerCase();
  if (type === 'manifest' && host !== 'raw.githubusercontent.com') throw Error('Manifest must use raw.githubusercontent.com');
  if (type === 'installer' && !['github.com','objects.githubusercontent.com','release-assets.githubusercontent.com'].includes(host)) throw Error('Untrusted installer host: ' + host);
  return url;
}
function getResponse(url, type, redirects = 0) {
  if (redirects > 6) return Promise.reject(Error('Too many redirects'));
  allowedURL(url, type);
  return new Promise((resolve, reject) => {
    https.get(url, {headers: {'User-Agent': 'BABEWARE-XXXECUTIVE-Updater/1.0', 'Accept': 'application/octet-stream, application/json'}}, response => {
      const code = response.statusCode || 0;
      if ([301,302,303,307,308].includes(code) && response.headers.location) {
        const next = new URL(response.headers.location, url).toString();
        response.resume();
        resolve(getResponse(next, type, redirects + 1));
      } else if (code !== 200) {
        response.resume(); reject(Error('HTTP ' + code));
      } else resolve(response);
    }).on('error', reject);
  });
}
async function fetchManifest() {
  const response = await getResponse(MANIFEST_URL, 'manifest');
  let bytes = 0, chunks = [];
  for await (const chunk of response) {
    bytes += chunk.length;
    if (bytes > MAX_MANIFEST) {response.destroy(); throw Error('Manifest too large');}
    chunks.push(chunk);
  }
  const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(data.version || '')) throw Error('Invalid manifest version');
  if (!/^[a-fA-F0-9]{64}$/.test(data.sha256 || '')) throw Error('Invalid SHA-256 checksum');
  allowedURL(data.installer_url, 'installer');
  if (!new URL(data.installer_url).pathname.endsWith('.exe')) throw Error('Installer must be an EXE');
  return data;
}
function newer(a,b) {
  const x=a.split('.').map(Number),y=b.split('.').map(Number);
  for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}
  return false;
}
async function check(silent = false) {
  if (!MANIFEST_URL) return {status:'error', message:'Update manifest URL not configured.'};
  try {
    const data=await fetchManifest();
    if(newer(data.version,VERSION)) {
      latest=data;
      emit('available','XXXECUTIVE v'+data.version+' is available.',{version:data.version});
      return {status:'available', version:data.version, current:VERSION};
    }
    latest=null;
    if(!silent)emit('current','You are up to date (v'+VERSION+').');
    return {status:'current', current:VERSION};
  } catch(e) {
    if(!silent)emit('error','Update check failed: '+e.message);
    return {status:'error', message:e.message};
  }
}
async function download() {
  if (busy) return {status:'error',message:'A download is already in progress.'};
  busy=true;
  let dest;
  try {
    // Refresh metadata to avoid using a stale installer URL.
    const data=await fetchManifest();
    if(!newer(data.version,VERSION)) return {status:'current'};
    const temp=await fs.promises.mkdtemp(path.join(os.tmpdir(),'xxxecutive-update-'));
    dest=path.join(temp,'XXXECUTIVE_Setup_v'+data.version+'.exe');
    const response=await getResponse(data.installer_url,'installer');
    const declared=Number(response.headers['content-length']||0);
    if(declared>MAX_INSTALLER)throw Error('Installer exceeds size limit');
    const hash=crypto.createHash('sha256');
    let received=0;
    const meter=new Transform({transform(chunk,_enc,callback){
      received+=chunk.length;
      if(received>MAX_INSTALLER)return callback(Error('Installer exceeds size limit'));
      hash.update(chunk);
      emit('progress','Downloading update...', {received,total:declared||null});
      callback(null,chunk);
    }});
    await pipeline(response,meter,fs.createWriteStream(dest,{flags:'wx'}));
    if(hash.digest('hex').toLowerCase()!==data.sha256.toLowerCase())throw Error('SHA-256 verification failed. Installer was not opened.');
    emit('verified','Installer verified. Waiting for your confirmation.');
    const result=await dialog.showMessageBox(win,{
      type:'question',buttons:['Open installer','Not now'],defaultId:1,cancelId:1,
      title:'XXXECUTIVE Update Ready',
      message:'XXXECUTIVE v'+data.version+' downloaded and verified.',
      detail:'Close XXXECUTIVE before proceeding with the installer. Open the installer now?'
    });
    if(result.response===0){
      const error=await shell.openPath(dest);
      if(error)throw Error('Could not open installer: '+error);
      emit('ready','Installer opened. Close XXXECUTIVE to continue.');
      return {status:'opened'};
    }
    emit('ready','Installer saved at '+dest);
    return {status:'saved',path:dest};
  }catch(e){
    if(dest)await fs.promises.rm(dest,{force:true}).catch(()=>{});
    emit('error','Update download failed: '+e.message);
    return {status:'error',message:e.message};
  }finally{busy=false;}
}
function createWindow(){
 win=new BrowserWindow({title:'XXXECUTIVE',width:1280,height:900,minWidth:850,minHeight:600,backgroundColor:'#08070a',icon:path.join(__dirname,'babeware-assets','mascot.ico'),autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:false}});
 win.loadFile(path.join(__dirname,'index.html'));
 win.webContents.once('did-finish-load',()=>setTimeout(()=>check(true),3000));
}
ipcMain.handle('updates:check',()=>check(false));
ipcMain.handle('updates:download',()=>download());
app.whenReady().then(()=>{createWindow();setInterval(()=>check(true),6*60*60*1000).unref();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
