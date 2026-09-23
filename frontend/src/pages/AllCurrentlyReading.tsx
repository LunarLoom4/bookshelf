import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookMarked, BookOpen, X } from "lucide-react";
import { usersApi, progressApi } from "@/api";
import { useAuthStore } from "@/stores/authStore";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import type { CurrentlyReadingItem } from "@/types";
import toast from "react-hot-toast";

export default function AllCurrentlyReading() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuthStore();
  const isSelf = currentUser?.username === username;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["user", username],
    queryFn: () => usersApi.profile(username!).then(r => r.data),
    enabled: !!username,
    staleTime: 60 * 1000,
  });

  const removeProgress = useMutation({
    mutationFn: (editionId: number) => progressApi.delete(editionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user", username] });
      toast.success("Removed from Currently Reading");
    },
    onError: () => toast.error("Failed to remove"),
  });

  const items: CurrentlyReadingItem[] = data?.currently_reading ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/u/${username}`} className="text-gray-400 hover:text-ink-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-serif text-2xl font-semibold text-ink-900 flex items-center gap-2">
          <BookMarked className="w-5 h-5 text-ink-400" />
          {isSelf ? "My" : `${username}'s`} Currently Reading
        </h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-ink-200 border-t-ink-600 rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">Nothing currently being read.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map(item => (
            <div key={item.edition_id} className="group relative flex flex-col gap-2">
              <Link to={`/read/${item.edition_id}`} className="flex flex-col gap-2">
                <div className="rounded-lg overflow-hidden bg-paper-100 dark:bg-gray-800 relative aspect-[3/4]">
                  {item.book_cover_url ? (
                    <img
                      src={item.book_cover_url}
                      alt={item.book_title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                    </div>
                  )}
                  {/* Page progress badge */}
                  <span className="absolute bottom-1.5 right-1.5 bg-black/65 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                    p.{item.last_page}
                  </span>
                </div>
                <p className="text-xs font-medium text-ink-900 dark:text-gray-100 line-clamp-2 leading-tight">
                  {item.book_title}
                </p>
              </Link>
              {isSelf && (
                <button
                  onClick={() => removeProgress.mutate(item.edition_id)}
                  disabled={removeProgress.isPending}
                  title="Remove from Currently Reading"
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <ScrollToTop />
    </div>
  );
}
