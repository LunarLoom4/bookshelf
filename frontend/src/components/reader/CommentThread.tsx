import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ChevronUp, ChevronDown, MessageSquare, BookOpen,
  Loader2, Pencil, Trash2, Check, X, Share2,
} from "lucide-react";
import { timeAgo } from "@/utils/time";
import toast from "react-hot-toast";
import type { Comment } from "@/types";
import { useAuthStore } from "@/stores/authStore";
import { useReplies, COMMENTS_KEY } from "@/hooks/useBooks";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/Avatar";
import { CommentBox } from "./CommentBox";
import { commentsApi } from "@/api";

// ── Mention highlighting ───────────────────────────────────────────────────────
function HighlightedBody({ body }: { body: string }) {
  // Split on @username patterns and make them clickable profile links
  const parts = body.split(/(@[\w-]+)/g);
  return (
    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        part.match(/^@[\w-]+$/) ? (
          <Link
            key={i}
            to={`/u/${part.slice(1)}`}
            className="text-ink-600 font-medium hover:underline"
            onClick={e => e.stopPropagation()}
          >
            {part}
          </Link>
        ) : (
          part
        )
      )}
    </p>
  );
}

// ── Quote preview shown above reply box ───────────────────────────────────────
function QuotePreview({ body, username }: { body: string; username: string }) {
  const snippet = body.length > 120 ? body.slice(0, 120) + "…" : body;
  return (
    <div className="flex gap-2 mb-2 pl-2 border-l-2 border-ink-300">
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-ink-600">{username}</span>
        <p className="text-xs text-gray-400 italic truncate">{snippet}</p>
      </div>
    </div>
  );
}

// ── Tombstone for soft-deleted comments ───────────────────────────────────────
function DeletedComment({ comment }: { comment: Comment }) {
  return (
    <div className="flex gap-2.5 py-3 opacity-50">
      <div className="flex flex-col items-center gap-0.5 flex-shrink-0 w-6" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded-full bg-gray-200 flex-shrink-0" />
          <span className="text-xs text-gray-400 italic">Deleted</span>
          <span className="text-xs text-gray-300">
            {timeAgo(comment.created_at)}
          </span>
        </div>
        <p className="text-xs text-gray-400 italic">[comment deleted]</p>
      </div>
    </div>
  );
}

interface Props {
  comment: Comment;
  editionId: number;
  onVote: (commentId: number, value: 1 | -1) => void;
  onReply: (body: string, pageNumber?: number, parentId?: number) => Promise<void>;
  onJumpToPage: (page: number) => void;
  onCommentDeleted?: (commentId: number) => void;
  onCommentEdited?: (comment: Comment) => void;
  depth?: number;
}

export function CommentThread({
  comment,
  editionId,
  onVote,
  onReply,
  onJumpToPage,
  onCommentDeleted,
  onCommentEdited,
  depth = 0,
}: Props) {
  const { user, isAuthenticated } = useAuthStore();
  const isOwner = user?.id === comment.author?.id;
  const queryClient = useQueryClient();

  const [showReplies, setShowReplies] = useState(false);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [editLoading, setEditLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shared, setShared] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const { data: replies = [], isLoading: loadingReplies } = useReplies(
    editionId, comment.id, showReplies
  );

  // ── Show tombstone for deleted comments ──────────────────────────────────
  if (comment.is_deleted) {
    return (
      <div className={depth > 0 ? "pl-3 border-l-2 border-paper-200" : ""}>
        <DeletedComment comment={comment} />
        {/* Still show replies under deleted comments */}
        {comment.reply_count > 0 && (
          <>
            <button
              onClick={() => setShowReplies(v => !v)}
              className="ml-8 mb-1 text-xs text-gray-400 hover:text-ink-600 transition-colors flex items-center gap-1"
            >
              <MessageSquare className="w-3 h-3" />
              {showReplies ? "Hide replies" : `${comment.reply_count} ${comment.reply_count === 1 ? "reply" : "replies"}`}
            </button>
            {showReplies && replies.length > 0 && (
              <div className="pl-4">
                {replies.map((reply) => (
                  <CommentThread key={reply.id} comment={reply} editionId={editionId}
                    onVote={onVote} onReply={onReply} onJumpToPage={onJumpToPage}
                    onCommentDeleted={onCommentDeleted} onCommentEdited={onCommentEdited}
                    depth={depth + 1} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  const handleReplySubmit = async (body: string, pn?: number) => {
    // Prepend @username if not already there
    const mentionedBody = body.startsWith(`@${comment.author?.username ?? ""}`)
      ? body
      : `@${comment.author?.username ?? ""} ${body}`;
    await onReply(mentionedBody, pn, comment.id);
    setShowReplies(true);
    setShowReplyBox(false);
  };

  const handleEdit = async () => {
    if (!editBody.trim() || editBody === comment.body) {
      setEditing(false);
      return;
    }
    setEditLoading(true);
    try {
      const res = await commentsApi.edit(editionId, comment.id, editBody);
      // Update cache directly so the edited body shows immediately
      const updateBody = (old: Comment[] | undefined) =>
        old?.map(c => c.id === comment.id
          ? { ...c, body: editBody, edited_at: new Date().toISOString() }
          : c
        );
      queryClient.setQueriesData(
        { queryKey: [COMMENTS_KEY, editionId], exact: false },
        updateBody
      );
      // Fire toast and close edit mode BEFORE invalidation to avoid remount swallowing the toast
      toast.success("Comment updated");
      setEditing(false);
      onCommentEdited?.();
    } catch (e: any) {
      console.error("Edit error:", e?.response?.status, e?.response?.data, e?.message);
      const status = e?.response?.status;
      if (!status || status < 400) {
        // Not a real error
        setEditing(false);
        return;
      }
      toast.error(e?.response?.data?.detail || "Failed to update comment");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await commentsApi.delete(editionId, comment.id);
      toast.success("Comment deleted");
      // Update cache directly so tombstone shows immediately in all open reply panels
      const markDeleted = (old: Comment[] | undefined) =>
        old?.map(c => c.id === comment.id ? { ...c, is_deleted: true, body: "" } : c);
      // Update top-level comments cache
      queryClient.setQueriesData(
        { queryKey: [COMMENTS_KEY, editionId], exact: false },
        markDeleted
      );
      onCommentDeleted?.(comment.id);
    } catch (e: any) {
      const status = e?.response?.status;
      if (!status || status < 400) {
        // 204 No Content -- treat as success, toast already fired above
        onCommentDeleted?.(comment.id);
        return;
      }
      toast.error(e?.response?.data?.detail || "Failed to delete comment");
    } finally {
      setDeleteLoading(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className={`flex flex-col ${depth > 0 ? "pl-3 border-l-2 border-paper-200" : ""}`}>
      <div className="flex gap-2.5 py-3">

        {/* Vote column */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => isAuthenticated && onVote(comment.id, 1)}
            disabled={!isAuthenticated}
            className={`p-0.5 rounded transition-all duration-150 active:scale-125 ${
              comment.user_vote === 1
                ? "text-amber-500 scale-110"
                : "text-gray-300 hover:text-amber-400 disabled:cursor-default"
            }`}
            title="Upvote"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <span className={`text-xs font-medium tabular-nums ${
            comment.vote_score > 0 ? "text-ink-600"
            : comment.vote_score < 0 ? "text-red-400"
            : "text-gray-400"
          }`}>
            <span className="tabular-nums transition-all duration-200">{comment.vote_score}</span>
          </span>
          <button
            onClick={() => isAuthenticated && onVote(comment.id, -1)}
            disabled={!isAuthenticated}
            className={`p-0.5 rounded transition-all duration-150 active:scale-125 ${
              comment.user_vote === -1
                ? "text-red-400 scale-110"
                : "text-gray-300 hover:text-red-300 disabled:cursor-default"
            }`}
            title="Downvote"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Link
              to={`/u/${comment.author?.username ?? ""}`}
              className="flex items-center gap-1.5 text-xs font-medium text-ink-700 hover:underline"
            >
              <Avatar username={comment.author?.username ?? "…"} avatarUrl={comment.author?.avatar_url} size="xs" />
              {comment.author?.username ?? ""}
            </Link>
            <span className="text-xs text-gray-400">
              {timeAgo(comment.created_at)}
            </span>
            {comment.edited_at && (
              <span className="text-xs text-gray-300 italic">(edited)</span>
            )}
            {comment.page_number != null && (
              <button
                onClick={() => onJumpToPage(comment.page_number!)}
                className="page-badge flex items-center gap-1"
                title={`Jump to page ${comment.page_number}`}
              >
                <BookOpen className="w-3 h-3" />
                p.&nbsp;{comment.page_number}
              </button>
            )}
          </div>

          {/* Body -- edit mode or display mode */}
          {editing ? (
            <div className="flex flex-col gap-1.5">
              <textarea
                ref={editRef}
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                rows={3}
                autoFocus
                className="input resize-none text-sm"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleEdit}
                  disabled={editLoading || !editBody.trim()}
                  className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {editLoading ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditBody(comment.body); }}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <HighlightedBody body={comment.body} />
          )}

          {/* Action row */}
          {!editing && (
            <div className="mt-2 flex items-center gap-3 flex-wrap">

              {/* Reply */}
              <button
                onClick={() => setShowReplyBox(v => !v)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-ink-600 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                {showReplyBox ? "Cancel" : "Reply"}
              </button>

              {/* Show/hide replies */}
              {comment.reply_count > 0 && (
                <button
                  onClick={() => setShowReplies(v => !v)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-ink-600 transition-colors"
                >
                  {loadingReplies
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <MessageSquare className="w-3.5 h-3.5" />
                  }
                  {showReplies
                    ? "Hide replies"
                    : `${comment.reply_count} ${comment.reply_count === 1 ? "reply" : "replies"}`}
                </button>
              )}

              {/* 27: Share comment link */}
              <button
                onClick={() => {
                  const url = `${window.location.origin}${window.location.pathname}?comment=${comment.id}`;
                  navigator.clipboard.writeText(url);
                  setShared(true);
                  setTimeout(() => setShared(false), 2000);
                }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-ink-600 transition-colors"
                title="Copy link to this comment"
              >
                <Share2 className="w-3 h-3" />
                {shared ? "Copied!" : "Share"}
              </button>

              {/* Edit / Delete -- owner only */}
              {isOwner && !confirmDelete && (
                <>
                  <button
                    onClick={() => { setEditing(true); setEditBody(comment.body); }}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-ink-600 transition-colors"
                    title="Edit comment"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete comment"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </>
              )}

              {/* Delete confirmation inline */}
              {isOwner && confirmDelete && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-500 font-medium">Delete this comment?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleteLoading}
                    className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
                  >
                    {deleteLoading ? "Deleting..." : "Yes"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reply box with quote preview */}
      {showReplyBox && (
        <div className="pl-7 pb-2">
          <QuotePreview body={comment.body} username={comment.author?.username ?? ""} />
          <CommentBox
            onSubmit={handleReplySubmit}
            parentId={comment.id}
            placeholder={`@${comment.author?.username ?? ""} `}
          />
        </div>
      )}

      {/* Replies */}
      {showReplies && replies.length > 0 && (
        <div className="pl-4">
          {replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              editionId={editionId}
              onVote={onVote}
              onReply={onReply}
              onJumpToPage={onJumpToPage}
              onCommentDeleted={onCommentDeleted}
              onCommentEdited={onCommentEdited}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
