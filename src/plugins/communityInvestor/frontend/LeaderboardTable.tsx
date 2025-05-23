import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import type { LeaderboardEntry, Recommendation, SupportedChain } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { cn } from './utils';

interface RecommendationDetailsProps {
  recommendations: Recommendation[];
  username: string;
}

const RecommendationDetails: React.FC<RecommendationDetailsProps> = ({
  recommendations,
  username,
}) => {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-muted-foreground">
          No recommendations available for {username}.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 mb-4 p-4 border bg-muted/30 rounded-lg shadow-inner">
      <h4 className="text-md font-semibold mb-3 text-center border-b pb-2">
        Detailed Recommendations for {username}
      </h4>
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {recommendations.map((rec) => (
          <Card key={rec.id} className="overflow-hidden shadow-md">
            <CardHeader className="pb-2 pt-3 px-4 bg-slate-50 dark:bg-slate-800">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-semibold">
                  {rec.tokenTicker ||
                    rec.tokenAddress.substring(0, 6) +
                      '...' +
                      rec.tokenAddress.substring(rec.tokenAddress.length - 4)}
                  <Badge variant="outline" className="ml-2 text-xs">
                    {rec.chain}
                  </Badge>
                </CardTitle>
                <Badge
                  variant={rec.recommendationType === 'BUY' ? 'success' : 'destructive'}
                  className="text-xs"
                >
                  {rec.recommendationType}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {new Date(rec.timestamp).toLocaleString()} - Conviction:
                <Badge variant="secondary" className="ml-1 text-xs font-normal">
                  {rec.conviction}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 py-3 space-y-1 text-xs">
              <p className="italic border-l-2 border-primary/50 pl-2 py-1 bg-primary/5 rounded-r-sm">
                \"{rec.rawMessageQuote}\"
              </p>
              {rec.priceAtRecommendation !== undefined && (
                <p>
                  Rec Price:{' '}
                  <span className="font-medium">${rec.priceAtRecommendation.toLocaleString()}</span>
                </p>
              )}
              {rec.metrics && (
                <div className="mt-2 pt-2 border-t border-border/50 text-xs space-y-1">
                  <p className="font-medium text-foreground/80">
                    Evaluation (as of{' '}
                    {new Date(rec.metrics.evaluationTimestamp).toLocaleDateString()}):
                  </p>
                  {rec.metrics.potentialProfitPercent !== undefined && (
                    <p>
                      Potential Profit:{' '}
                      <span
                        className={cn(
                          'font-semibold',
                          rec.metrics.potentialProfitPercent >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        )}
                      >
                        {rec.metrics.potentialProfitPercent.toFixed(1)}%
                      </span>
                    </p>
                  )}
                  {rec.metrics.avoidedLossPercent !== undefined && (
                    <p>
                      Avoided Loss:{' '}
                      <span className={cn('font-semibold text-green-600')}>
                        {rec.metrics.avoidedLossPercent.toFixed(1)}%
                      </span>
                    </p>
                  )}
                  {rec.metrics.isScamOrRug && (
                    <Badge variant="destructive" className="my-1 text-xs">
                      Flagged: Scam/Rug
                    </Badge>
                  )}
                  {rec.metrics.notes && (
                    <p className="text-muted-foreground">Notes: {rec.metrics.notes}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

interface LeaderboardTableProps {
  data: LeaderboardEntry[];
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ data }) => {
  const [expandedUser, setExpandedUser] = React.useState<string | null>(null);

  const toggleExpand = (userId: string) => {
    setExpandedUser(expandedUser === userId ? null : userId);
  };

  if (!data || data.length === 0) {
    return (
      <p className="text-center py-8 text-muted-foreground">No leaderboard data to display.</p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px] text-center">Rank</TableHead>
            <TableHead>Username</TableHead>
            <TableHead className="text-right w-[120px]">Trust Score</TableHead>
            <TableHead className="w-[130px] text-center">View History</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((entry) => (
            <React.Fragment key={entry.userId}>
              <TableRow className={cn(expandedUser === entry.userId && 'bg-muted/50')}>
                <TableCell className="font-medium text-center">{entry.rank}</TableCell>
                <TableCell className="font-medium">
                  {entry.username || entry.userId.substring(0, 12) + '...'}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-bold',
                    entry.trustScore > 5
                      ? 'text-green-600 dark:text-green-500'
                      : entry.trustScore < -5
                        ? 'text-red-600 dark:text-red-500'
                        : 'text-foreground/80'
                  )}
                >
                  {entry.trustScore.toFixed(2)}
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleExpand(entry.userId.toString())}
                    className="h-7 px-2 text-xs"
                  >
                    {expandedUser === entry.userId.toString() ? 'Hide' : 'View Recs'}
                  </Button>
                </TableCell>
              </TableRow>
              {expandedUser === entry.userId.toString() && (
                <TableRow className="bg-background hover:bg-background">
                  <TableCell colSpan={4} className="p-0">
                    <RecommendationDetails
                      recommendations={entry.recommendations}
                      username={entry.username || entry.userId.toString()}
                    />
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </>
  );
};
