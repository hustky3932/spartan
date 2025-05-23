import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import './index.css';
import { LeaderboardTable } from './LeaderboardTable';
import Loader from './loader';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import type { UUID } from '@elizaos/core';
// Import types from the central types.ts file
import {
  type LeaderboardEntry,
  type Recommendation,
  type RecommendationMetric,
  SupportedChain,
} from '../types'; // Adjusted path to central types.ts

const queryClient = new QueryClient();

// Function to fetch real leaderboard data from the backend
async function fetchLeaderboardData(): Promise<LeaderboardEntry[]> {
  const response = await fetch('/api/plugins/community-investor/leaderboard'); // API endpoint
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: 'Failed to parse error response' }));
    throw new Error(errorData.message || `Network response was not ok: ${response.statusText}`);
  }
  const data = await response.json();

  // Transform the data to ensure proper typing
  const transformedData: LeaderboardEntry[] = (data as any[]).map((entry: any) => ({
    userId: entry.userId as UUID,
    username: entry.username,
    trustScore: entry.trustScore,
    recommendations: (entry.recommendations || []).map(
      (rec: any) =>
        ({
          id: rec.id as UUID,
          userId: rec.userId as UUID,
          messageId: rec.messageId as UUID,
          timestamp: rec.timestamp,
          tokenTicker: rec.tokenTicker,
          tokenAddress: rec.tokenAddress,
          chain: rec.chain as SupportedChain,
          recommendationType: rec.recommendationType as 'BUY' | 'SELL',
          conviction: rec.conviction as 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH',
          rawMessageQuote: rec.rawMessageQuote,
          priceAtRecommendation: rec.priceAtRecommendation,
          metrics: rec.metrics as RecommendationMetric,
          processedForTradeDecision: rec.processedForTradeDecision,
        }) as Recommendation
    ),
  }));

  // Sort and rank the data
  return transformedData
    .sort((a, b) => b.trustScore - a.trustScore)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function App() {
  const {
    data: leaderboardData,
    isLoading,
    error,
  } = useQuery<LeaderboardEntry[], Error>({
    queryKey: ['leaderboardData'],
    queryFn: fetchLeaderboardData,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col gap-4 my-4 bg-background text-foreground">
        <div className="container mx-auto px-4">
          <header className="py-6">
            <h1 className="text-4xl font-bold tracking-tight">Marketplace of Trust</h1>
            <p className="text-xl text-muted-foreground">Community-Powered Alpha Leaderboard</p>
          </header>

          <main className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Community Investors</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading && <Loader />}
                {error && (
                  <div className="text-red-500 p-4 border border-red-500 rounded-md">
                    Error fetching leaderboard: {error.message}
                  </div>
                )}
                {leaderboardData && <LeaderboardTable data={leaderboardData} />}
                {leaderboardData && leaderboardData.length === 0 && !isLoading && (
                  <p className="text-muted-foreground text-center py-4">
                    No leaderboard data available yet. Check back soon!
                  </p>
                )}
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
