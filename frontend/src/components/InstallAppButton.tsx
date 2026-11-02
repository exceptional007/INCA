import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let installPrompt: InstallEvent | null = null;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event as InstallEvent; });
export function InstallAppButton() {
  const [help, setHelp] = useState(false);
  const [installed, setInstalled] = useState(matchMedia('(display-mode: standalone)').matches);
  useEffect(() => {
    const done = () => { setInstalled(true); installPrompt = null; };
    window.addEventListener('appinstalled', done);
    return () => window.removeEventListener('appinstalled', done);
  }, []);
  const install = async () => {
    const prompt = installPrompt;
    if (!prompt) { setHelp(true); return; }
    try { await prompt.prompt(); await prompt.userChoice; installPrompt = null; }
    catch { setHelp(true); }
  };
  return <>
    <Button variant="outline" className="gap-2 rounded-xl" onClick={() => void install()} disabled={installed}><Download className="size-4" />{installed ? 'App installed' : 'Download / Install app'}</Button>
    <Dialog open={help} onOpenChange={setHelp}><DialogContent><DialogHeader><DialogTitle>Install INCA</DialogTitle><DialogDescription>Use INCA in your browser or add it to your device as an app.</DialogDescription></DialogHeader>
      <div className="space-y-3 text-sm"><p><strong>Android / desktop Chrome or Edge:</strong> open the browser menu and choose Install app or Add to Home screen.</p><p><strong>iPhone / iPad:</strong> open this website in Safari, tap Share, then Add to Home Screen.</p><p className="text-muted-foreground">If you are using an in-app browser, open this page in your device’s browser first. Installation does not require an APK. Faculty should prepare today’s classes while online before taking attendance offline.</p></div>
    </DialogContent></Dialog>
  </>;
}
