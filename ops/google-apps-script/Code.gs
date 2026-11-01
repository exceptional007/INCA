/** INCA recovery-only mail gateway. Deploy as a Google Apps Script Web App.
 * Configure Script Properties; never paste secrets into this source or log requests. */
function doGet() {
  return json_({service:'INCA recovery mail gateway'});
}

function doPost(e) {
  try {
    if(!e || !e.postData || e.postData.contents.length>12000) return json_({success:false});
    const payload=JSON.parse(e.postData.contents);
    const props=PropertiesService.getScriptProperties();
    const secret=props.getProperty('INCA_MAIL_API_KEY')||'';
    if(!validKey_(payload.apiKey,secret)) return json_({success:false});
    const origin=(props.getProperty('INCA_FRONTEND_URL')||'').replace(/\/$/,'');
    if(!/^https?:\/\/[A-Za-z0-9.-]+(?::[0-9]+)?$/.test(origin)) return json_({success:false});
    if(payload.action==='check') return json_({success:true,ready:MailApp.getRemainingDailyQuota()>0});
    const to=typeof payload.to==='string'?payload.to.trim().toLowerCase():'';
    const allowedDomain=(props.getProperty('INCA_RECIPIENT_DOMAIN')||'bit.ac.in').toLowerCase();
    const testRecipient=(props.getProperty('INCA_TEST_RECIPIENT')||'').trim().toLowerCase();
    if(!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(to) || (to.split('@')[1]!==allowedDomain && to!==testRecipient)) return json_({success:false});
    if(payload.subject!=='Reset your INCA password' || typeof payload.text!=='string') return json_({success:false});
    const prefix=origin+'/reset-password#token=';
    const start=payload.text.indexOf(prefix);
    if(start<0) return json_({success:false});
    const match=payload.text.slice(start+prefix.length).match(/^([A-Za-z0-9_-]{43})(?:\s|$)/);
    if(!match || MailApp.getRemainingDailyQuota()<1) return json_({success:false});
    // Construct the message ourselves: this endpoint cannot act as a general mail relay.
    MailApp.sendEmail({to:to,subject:'Reset your INCA password',name:'INCA Campus',body:'Use this single-use link within 20 minutes to reset your INCA password: '+prefix+match[1]+'\nIf you did not request this, ignore this message.'});
    return json_({success:true});
  } catch (_) {
    return json_({success:false});
  }
}

function validKey_(provided,expected) {
  if(typeof provided!=='string' || !/^[a-f0-9]{64}$/.test(provided) || !/^[a-f0-9]{64}$/.test(expected)) return false;
  const a=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,provided);
  const b=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,expected);
  let difference=0;
  for(let i=0;i<a.length;i++) difference|=a[i]^b[i];
  return difference===0;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
