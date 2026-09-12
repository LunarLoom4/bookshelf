import { useState } from "react";
import { Search, X } from "lucide-react";
import { useBooks, useBookSearch } from "@/hooks/useBooks";
import { BookCard } from "@/components/ui/BookCard";
import { useDebounce } from "@/hooks/useDebounce";

export default function Browse() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data: allBooks, isLoading: loadingAll } = useBooks(0, 40);
  const { data: searchResults, isLoading: loadingSearch } = useBookSearch(debouncedQuery);

  const books = debouncedQuery ? searchResults : allBooks;
  const loading = debouncedQuery ? loadingSearch : loadingAll;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink-900">Browse books</h1>
          <p className="text-sm text-gray-500 mt-1">
            {allBooks ? `${allBooks.length} books uploaded` : ""}
          </p>
        </div>

        <div className="sm:ml-auto relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by title or author..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input pl-9 pr-8"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-ink-200 border-t-ink-600 rounded-full animate-spin" />
        </div>
      ) : books && books.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 text-gray-400">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {debouncedQuery ? `No results for "${debouncedQuery}"` : "No books uploaded yet."}
          </p>
        </div>
      )}
    </div>
  );
}
