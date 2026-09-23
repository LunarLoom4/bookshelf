import { useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ArrowLeft, List, Globe2, LockKeyhole, BookOpen } from "lucide-react";
import { timeAgo } from "@/utils/time";
import { useAuthStore } from "@/stores/authStore";
import { useUserReadingLists, useMyReadingLists } from "@/hooks/useBooks";
import type { ReadingList } from "@/types";
import { ScrollToTop } from "@/components/ui/ScrollToTop";

const PAGE = 30;

function CoverCollage({ urls }: { urls: string[] }) {
  const imgs = urls.filter(Boolean).slice(0, 4);
  const n = imgs.length;
  if (n === 0) return <div className="w-full h-full bg-paper-200 dark:bg-gray-700 flex items-center justify-center"><BookOpen className="w-6 h-6 text-gray-300" /></div>;
  if (n === 1) return <img src={imgs[0]} alt="" className="w-full h-full object-cover" />;
  if (n === 2) return <div className="flex gap-px w-full h-full">{imgs.map((u,i) => <div key={i} className="flex-1 overflow-hidden"><img src={u} alt="" className="w-full h-full object-cover" /></div>)}</div>;
  if (n === 3) return (
    <div className="flex flex-col gap-px w-full h-full">
      <div className="flex gap-px flex-1">{[imgs[0],imgs[1]].map((u,i) => <div key={i} className="flex-1 overflow-hidden"><img src={u} alt="" className="w-full h-full object-cover" /></div>)}</div>
      <div className="flex justify-center flex-1"><div className="w-1/2 overflow-hidden"><img src={imgs[2]} alt="" className="w-full h-full object-cover" /></div></div>
    </div>
  );
  return (
    <div className="relative w-full h-full">
      {[0,1,2,3].map(i => (
        <div key={i} className="absolute w-1/2 h-1/2 overflow-hidden" style={{ top: i < 2 ? 0 : "50%", left: i % 2 === 0 ? 0 : "50%" }}>
          <img src={imgs[i]} alt="" className="w-full h-full object-cover" />
        </div>
      ))}
    </div>
  );
}

export default function AllReadingLists() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const isSelf = currentUser?.username === username;
  const [visibleCount, setVisibleCount] = useState(PAGE);

  useEffect(() => { window.scrollTo(0, 0); }, []);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: publicLists = [], isLoading: loadingPublic } = useUserReadingLists(isSelf ? "" : username!);
  const { data: myLists = [], isLoading: loadingMine } = useMyReadingLists();

  const allLists: ReadingList[] = isSelf ? myLists : publicLists;
  const isLoading = isSelf ? loadingMine : loadingPublic;
  const lists = allLists.slice(0, visibleCount);
  const hasMore = visibleCount < allLists.length;

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisibleCount(v => v + PAGE);
    }, { threshold: 0.8 });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, lists.length]);

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
        <List className="w-5 h-5 text-ink-400" />
        {isSelf ? "My" : `${username}'s`} Reading Lists
      </h1>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-ink-200 border-t-ink-600 rounded-full animate-spin" /></div>
      ) : lists.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">{isSelf ? "No reading lists yet." : "No public reading lists."}</p>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {lists.map(list => (
            <Link
              key={list.id}
              to={`/lists/${list.id}`}
              className="group bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md hover:border-ink-300 dark:hover:border-indigo-700 transition-all duration-200"
            >
              <div className="aspect-[3/2] overflow-hidden bg-paper-100 dark:bg-gray-800 relative">
                <CoverCollage urls={list.cover_urls ?? []} />
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-900 dark:text-gray-100 line-clamp-1 group-hover:text-ink-600 transition-colors">{list.name}</p>
                  {isSelf && (list.is_public
                    ? <Globe2 className="w-3.5 h-3.5 text-ink-500 flex-shrink-0 mt-0.5" />
                    : <LockKeyhole className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">{list.item_count} {list.item_count === 1 ? "book" : "books"} · Updated {timeAgo(list.updated_at, true)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-12 flex items-center justify-center mt-4">
        {hasMore && <div className="w-6 h-6 border-4 border-ink-200 border-t-ink-600 rounded-full animate-spin" />}
      </div>
      <ScrollToTop />
    </div>
  );
}
