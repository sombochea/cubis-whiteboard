"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Collaborator {
  id: string;
  role: string;
  userId: string;
  userName: string;
  userEmail: string;
}

interface ShareDialogProps {
  whiteboardId: string;
  isPublic: boolean;
  onTogglePublic: (isPublic: boolean) => void;
}

export default function ShareDialog({ whiteboardId, isPublic, onTogglePublic }: ShareDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [open, setOpen] = useState(false);

  const fetchCollaborators = async () => {
    const res = await fetch(`/api/whiteboards/${whiteboardId}/collaborate`);
    if (res.ok) setCollaborators(await res.json());
  };

  const addCollaborator = async () => {
    if (!email.trim()) return;
    const res = await fetch(`/api/whiteboards/${whiteboardId}/collaborate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    if (res.ok) {
      setEmail("");
      fetchCollaborators();
      toast.success("Collaborator added");
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to add");
    }
  };

  const removeCollaborator = async (collaboratorId: string) => {
    await fetch(`/api/whiteboards/${whiteboardId}/collaborate`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collaboratorId }),
    });
    fetchCollaborators();
    toast.success("Removed");
  };

  const togglePublic = async () => {
    const res = await fetch(`/api/whiteboards/${whiteboardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !isPublic }),
    });
    if (res.ok) onTogglePublic(!isPublic);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) fetchCollaborators();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="default"
          size="sm"
          className="h-8 rounded-lg bg-indigo-600 px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Whiteboard</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Public toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm">Public access</span>
            <Button variant={isPublic ? "default" : "outline"} size="sm" onClick={togglePublic}>
              {isPublic ? "Public" : "Private"}
            </Button>
          </div>

          {/* Add collaborator */}
          <div className="flex gap-2">
            <Input
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCollaborator()}
              className="flex-1"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">{role}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setRole("viewer")}>Viewer</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRole("editor")}>Editor</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={addCollaborator}>Add</Button>
          </div>

          {/* Collaborator list */}
          <div className="space-y-2">
            {collaborators.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{c.userName}</span>
                  <span className="text-muted-foreground ml-2">{c.userEmail}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{c.role}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCollaborator(c.id)}
                    className="h-6 text-destructive"
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
