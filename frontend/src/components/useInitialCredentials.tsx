import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function generateInitialPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function useInitialCredentials() {
  const [credentials, setCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  return {
    showCredentials: (email: string, password: string) =>
      setCredentials({ email, password }),
    credentialsDialog: (
      <Dialog
        open={credentials !== null}
        onOpenChange={(open) => {
          if (!open) setCredentials(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account created</DialogTitle>
            <DialogDescription>
              Save these initial credentials and share them privately with the
              account holder. They are shown only for this creation.
            </DialogDescription>
          </DialogHeader>
          <p className="break-all">{credentials?.email}</p>
          <code className="block break-all select-text rounded bg-muted p-3">
            {credentials?.password}
          </code>
          <Button onClick={() => setCredentials(null)}>
            I have saved the credentials
          </Button>
        </DialogContent>
      </Dialog>
    ),
  };
}
