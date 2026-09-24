import { useParams, Link, useNavigate } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft, BookMarked, BookOpen, X } from "lucide-react";
import { usersApi, progressApi } from "@/api";
import { useAuthStore } from "@/stores/authStore";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import type { CurrentlyReadingItem } from "@/types";
import toast from "react-hot-toast";

const PAGE_SIZE = 20;

export default function AllCurrentlyReading() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const isSelf = currentUser?.username === username;
  const qc = useQueryClient();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["user-currently-reading", username],
    queryFn: ({ pageParam = 0 }) =>
      usersApi.currentlyReading(username!, pageParam as number, PAGE_SIZE).then(r => r.data),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    enabled: !!username,
    staleTime: 60 * 1000,
  });

  const removeProgress = useMutation({
    mutationFn: (editionId: number) => progressApi.delete(editionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-currently-reading", username] });
      qc.invalidateQueries({ queryKey: ["user", username] });
      toast.success("Removed from Currently Reading");
    },
    onError: () => toast.error("Failed to remove"),
  });

  const items: CurrentlyReadingItem[] = data?.pages.flat() ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs font-medium mb-4"
      >
        <ArrowLeft className="w-3 h-3" />
        Back
      </button>
      <h1 className="font-serif text-2xl font-semibold text-ink-900 dark:text-gray-100 flex items-center gap-2 mb-6">
        <BookMarked className="w-5 h-5 text-ink-400" />
        {isSelf ? "My Currently Reading" : "Currently Reading"}
      </h1>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">Nothing currently being read.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map(item => (
            <div key={item.edition_id} className="group relative">
              <Link to={`/read/${item.edition_id}`} className="block relative rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-200 aspect-[3/4]">
                {item.book_cover_url ? (
                  <img src={item.book_cover_url} alt={item.book_title} loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full bg-paper-200 dark:bg-gray-800 flex items-center justify-center">
                    <BookOpen className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                  </div>
                )}
                <span className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                  p.{item.last_page}
                </span>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent pt-10 px-2.5 pb-2.5">
                  <p className="text-xs font-semibold text-white line-clamp-2 leading-tight mb-1">{item.book_title}</p>
                  <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-white whitespace-nowrap">
                    Ed. {(item as any).edition_number ?? 1}
                  </span>
                </div>
              </Link>
              {isSelf && (
                <button
                  onClick={() => removeProgress.mutate(item.edition_id)}
                  disabled={removeProgress.isPending}
                  title="Remove from Currently Reading"
                  className="absolute top-2 left-2 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div
        ref={(el) => {
          if (!el || !hasNextPage) return;
          const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage(); },
            { rootMargin: "200px" }
          );
          obs.observe(el);
        }}
        className="h-10 flex items-center justify-center mt-6"
      >
        {isFetchingNextPage && (
          <div className="w-6 h-6 border-4 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
        )}
      </div>
      <ScrollToTop />
    </div>
  );
}
