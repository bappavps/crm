
"use client"

import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"
import { useRouter } from "next/navigation"

export function NotificationBell() {
  const firestore = useFirestore()
  const router = useRouter()

  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'notifications');
  }, [firestore])

  const { data: notifications } = useCollection(notificationsQuery)
  const unreadCount = notifications?.length || 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Production Alerts</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications && notifications.length > 0 ? (
          notifications.map((notif) => (
            <DropdownMenuItem 
              key={notif.id} 
              className="flex flex-col items-start gap-1 cursor-pointer p-3"
              onClick={() => router.push('/inventory/slitting')}
            >
              <p className="text-sm font-bold">{notif.message}</p>
              <span className="text-[10px] text-muted-foreground italic">
                {new Date(notif.createdAt).toLocaleTimeString()}
              </span>
            </DropdownMenuItem>
          ))
        ) : (
          <div className="p-4 text-center text-xs text-muted-foreground italic">
            No pending slitting tasks.
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
