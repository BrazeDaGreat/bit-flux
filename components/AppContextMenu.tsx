"use client";

import {
  Keyboard,
  PictureInPicture2,
  RefreshCw,
  RotateCw,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  type ContextMenuPoint,
} from "@/components/ContextMenu";
import { freshness } from "@/lib/freshness";
import { shortcutsStore } from "@/lib/shortcuts-store";
import { stickyStore } from "@/lib/sticky-store";

interface OpenMenu {
  point: ContextMenuPoint;
}

/**
 * The app's answer to a right-click that no more specific surface claimed.
 *
 * This listens at document level so Thought rows and the rail can keep their
 * own menus. Their React handlers prevent the native event first; by the time
 * it reaches this listener, `defaultPrevented` tells us to stand down.
 */
export default function AppContextMenu() {
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const open = (event: MouseEvent) => {
      if (event.defaultPrevented) {
        setMenu(null);
        return;
      }

      event.preventDefault();
      setMenu({
        point: { x: event.clientX, y: event.clientY },
      });
    };

    document.addEventListener("contextmenu", open);
    return () => document.removeEventListener("contextmenu", open);
  }, []);

  const refetch = useCallback(() => {
    freshness.mark(pathname);
    router.refresh();
  }, [pathname, router]);

  return (
    <ContextMenu
      point={menu?.point ?? null}
      onClose={() => setMenu(null)}
      ariaLabel="Page actions"
    >
      <ContextMenuItem
        icon={<PictureInPicture2 />}
        onClick={() => stickyStore.request()}
      >
        Open PiP
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem icon={<RefreshCw />} onClick={refetch}>
        Re-fetch Data
      </ContextMenuItem>
      <ContextMenuItem icon={<RotateCw />} onClick={() => window.location.reload()}>
        Refresh Page
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem icon={<Keyboard />} onClick={() => shortcutsStore.request()}>
        Keyboard Shortcuts
      </ContextMenuItem>
    </ContextMenu>
  );
}
