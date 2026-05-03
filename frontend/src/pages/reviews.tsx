import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListMerchantReviews, useReplyToReview, getListMerchantReviewsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Star, MessageSquare, Package, Check, Pencil, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { motion } from "framer-motion";

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-4 h-4 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review, onReplySaved }: { review: any; onReplySaved: () => void }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState(review.merchantReply ?? "");

  const replyMutation = useReplyToReview({
    mutation: {
      onSuccess: () => {
        setReplyOpen(false);
        onReplySaved();
        toast.success("Reply saved");
      },
      onError: () => toast.error("Failed to save reply"),
    },
  });

  const handleSaveReply = () => {
    replyMutation.mutate({ id: review.id, data: { reply: replyText.trim() } });
  };

  const handleRemoveReply = () => {
    replyMutation.mutate(
      { id: review.id, data: { reply: "" } },
      {
        onSuccess: () => {
          setReplyText("");
          setReplyOpen(false);
          onReplySaved();
          toast.success("Reply removed");
        },
      }
    );
  };

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            {review.productName && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Package className="w-3 h-3" />
                {review.productName}
              </Badge>
            )}
            <div className="flex items-center gap-2">
              <StarDisplay rating={review.rating} />
              <span className="text-xs text-muted-foreground">
                {review.customerName || "Anonymous"} ·{" "}
                {format(new Date(review.createdAt), "MMM d, yyyy")}
              </span>
            </div>
          </div>

          {!replyOpen && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-7 shrink-0"
              onClick={() => {
                setReplyText(review.merchantReply ?? "");
                setReplyOpen(true);
              }}
            >
              {review.merchantReply ? (
                <><Pencil className="w-3 h-3" /> Edit Reply</>
              ) : (
                <><MessageSquare className="w-3 h-3" /> Reply</>
              )}
            </Button>
          )}
        </div>

        {review.comment ? (
          <p className="text-sm text-foreground/80 leading-relaxed">{review.comment}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No written review</p>
        )}

        {review.merchantReply && !replyOpen && (
          <div className="rounded-lg bg-primary/5 border border-primary/10 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-primary">Your reply</p>
            <p className="text-sm text-foreground/80">{review.merchantReply}</p>
            {review.repliedAt && (
              <p className="text-xs text-muted-foreground">
                {format(new Date(review.repliedAt), "MMM d, yyyy")}
              </p>
            )}
          </div>
        )}

        {replyOpen && (
          <div className="space-y-2">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a public reply visible to all customers…"
              className="text-sm resize-none h-24"
              maxLength={500}
              autoFocus
            />
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                className="gap-1.5"
                disabled={replyMutation.isPending}
                onClick={handleSaveReply}
              >
                {replyMutation.isPending ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {replyMutation.isPending ? "Saving…" : "Save Reply"}
              </Button>
              {review.merchantReply && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/5"
                  disabled={replyMutation.isPending}
                  onClick={handleRemoveReply}
                >
                  Remove Reply
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={replyMutation.isPending}
                onClick={() => setReplyOpen(false)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ReviewsPage() {
  const queryClient = useQueryClient();
  const { data: reviews = [], isLoading } = useListMerchantReviews();
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);

  const totalCount = reviews.length;
  const avgRating = totalCount
    ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / totalCount
    : 0;
  const byStars = [5, 4, 3, 2, 1].map((s) => ({
    star: s,
    count: reviews.filter((r: any) => r.rating === s).length,
  }));

  const filtered = ratingFilter
    ? reviews.filter((r: any) => r.rating === ratingFilter)
    : reviews;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListMerchantReviewsQueryKey() });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
          <p className="text-muted-foreground">Customer feedback across all your products.</p>
        </div>

        {/* Summary stats */}
        {totalCount > 0 && (
          <Card>
            <CardContent className="pt-5">
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="text-center sm:text-left sm:pr-6 sm:border-r shrink-0">
                  <p className="text-5xl font-bold tracking-tight">{avgRating.toFixed(1)}</p>
                  <div className="flex justify-center sm:justify-start mt-1 gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`w-5 h-5 ${n <= Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {totalCount} review{totalCount !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="flex-1 space-y-2">
                  {byStars.map(({ star, count }) => (
                    <button
                      key={star}
                      className="w-full flex items-center gap-2 group"
                      onClick={() => setRatingFilter(ratingFilter === star ? null : star)}
                    >
                      <span className="text-xs text-muted-foreground w-3 text-right">{star}</span>
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${ratingFilter === star ? "bg-amber-500" : "bg-amber-400"}`}
                          style={{ width: totalCount ? `${(count / totalCount) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-5 text-right">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filter pills */}
        {totalCount > 0 && (
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={ratingFilter === null ? "default" : "outline"}
              className="rounded-full h-8"
              onClick={() => setRatingFilter(null)}
            >
              All ({totalCount})
            </Button>
            {byStars
              .filter((b) => b.count > 0)
              .map(({ star, count }) => (
                <Button
                  key={star}
                  size="sm"
                  variant={ratingFilter === star ? "default" : "outline"}
                  className="rounded-full h-8 gap-1"
                  onClick={() => setRatingFilter(ratingFilter === star ? null : star)}
                >
                  <Star className="w-3 h-3 fill-current" />
                  {star} ({count})
                </Button>
              ))}
          </div>
        )}

        {/* Review list */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading reviews…</div>
        ) : totalCount === 0 ? (
          <div className="text-center py-20">
            <Star className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">No reviews yet</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Reviews appear here after customers mark their orders complete and leave a rating.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No {ratingFilter}-star reviews.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((review: any, i: number) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <ReviewCard review={review} onReplySaved={invalidate} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
