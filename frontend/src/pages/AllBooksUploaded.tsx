import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { usersApi } from "@/api";
import { useAuthStore } from "@/stores/authStore";
import { OverlayBookCard } from "@/components/ui/OverlayBookCard";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { BookCardSkeleton } from "@/components/ui/Skeleton";

export default function AllBooksUploaded() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const isSelf = currentUser?.username === username;

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["user", username],
    queryFn: () => usersApi.profile(username!).then(r => r.data),
    enabled: !!username,
    staleTime: 60 * 1000,
  });

  const books = data?.books_uploaded ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs font-medium mb-4"
      >
        <ArrowLeft className="w-3 h-3" />
        Back
      </button>
      <h1 className="font-serif text-2xl font-semibold text-ink-900 dark:text-gray-100 flex items-center gap-2 mb-6">
        <BookOpen className="w-5 h-5 text-ink-400" />
        {isSelf ? "My Books" : `${username}'s Books`}
      </h1>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => <BookCardSkeleton key={i} />)}
        </div>
      ) : books.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">No books uploaded yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {books.map((book) => (
            <OverlayBookCard key={book.id} book={book} />
          ))}
        </div>
      )}
      <ScrollToTop />
    </div>
  );
}
