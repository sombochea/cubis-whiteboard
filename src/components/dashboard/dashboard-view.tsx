"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Whiteboard {
  id: string;
  title: string;
  updatedAt: string;
  isPublic: boolean;
  role: "owner" | "collaborator";
}

interface Collection {
  id: string;
  name: string;
  description?: string;
}

export default function DashboardView({ userId }: { userId: string }) {
  const router = useRouter();
  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [search, setSearch] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [draggedWb, setDraggedWb] = useState<string | null>(null);

  const fetchWhiteboards = useCallback(async () => {
    const res = await fetch(`/api/whiteboards?q=${encodeURIComponent(search)}`);
    if (res.ok) setWhiteboards(await res.json());
  }, [search]);

  const fetchCollections = useCallback(async () => {
    const res = await fetch("/api/collections");
    if (res.ok) setCollections(await res.json());
  }, []);

  useEffect(() => {
    fetchWhiteboards();
    fetchCollections();
  }, [fetchWhiteboards, fetchCollections]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(fetchWhiteboards, 300);
    return () => clearTimeout(t);
  }, [search]);

  const createWhiteboard = async () => {
    const res = await fetch("/api/whiteboards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled" }),
    });
    if (res.ok) {
      const wb = await res.json();
      router.push(`/whiteboards/${wb.id}`);
    }
  };

  const deleteWhiteboard = async (id: string) => {
    await fetch(`/api/whiteboards/${id}`, { method: "DELETE" });
    toast.success("Deleted");
    fetchWhiteboards();
  };

  const createCollection = async () => {
    if (!newCollectionName.trim()) return;
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCollectionName }),
    });
    if (res.ok) {
      setNewCollectionName("");
      setCollectionDialogOpen(false);
      fetchCollections();
      toast.success("Collection created");
    }
  };

  const handleDrop = async (collectionId: string) => {
    if (!draggedWb) return;
    await fetch(`/api/collections/${collectionId}/whiteboards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whiteboardId: draggedWb }),
    });
    setDraggedWb(null);
    toast.success("Added to collection");
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Whiteboards</h1>
        <div className="flex gap-2">
          <Dialog open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">New Collection</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Collection</DialogTitle>
              </DialogHeader>
              <Input
                placeholder="Collection name"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createCollection()}
              />
              <Button onClick={createCollection}>Create</Button>
            </DialogContent>
          </Dialog>
          <Button onClick={createWhiteboard}>New Whiteboard</Button>
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder="Search whiteboards by title..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {/* Collections sidebar */}
      {collections.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Collections</h2>
          <div className="flex flex-wrap gap-2">
            {collections.map((col) => (
              <Card
                key={col.id}
                className="cursor-pointer hover:border-primary transition-colors min-w-[150px]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(col.id)}
                onClick={() => router.push(`/collections/${col.id}`)}
              >
                <CardHeader className="p-3">
                  <CardTitle className="text-sm">{col.name}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Whiteboard grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {whiteboards.map((wb) => (
          <Card
            key={wb.id}
            className="group cursor-pointer hover:shadow-md transition-shadow"
            draggable
            onDragStart={() => setDraggedWb(wb.id)}
            onDragEnd={() => setDraggedWb(null)}
            onClick={() => router.push(`/whiteboards/${wb.id}`)}
          >
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm truncate">{wb.title}</CardTitle>
                <div className="flex items-center gap-1">
                  {wb.role === "collaborator" && (
                    <Badge variant="secondary" className="text-xs">Shared</Badge>
                  )}
                  {wb.isPublic && (
                    <Badge variant="outline" className="text-xs">Public</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="h-24 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">
                Preview
              </div>
            </CardContent>
            <CardFooter className="p-4 pt-0 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {new Date(wb.updatedAt).toLocaleDateString()}
              </span>
              {wb.role === "owner" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      ⋯
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWhiteboard(wb.id);
                      }}
                      className="text-destructive"
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </CardFooter>
          </Card>
        ))}
        {whiteboards.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No whiteboards yet. Create one to get started!
          </div>
        )}
      </div>
    </div>
  );
}
