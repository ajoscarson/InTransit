import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useFilmStocks() {
  return useQuery({
    queryKey: ['film-stocks'],
    queryFn: () => api.get('/api/film-stocks').then((r) => r.data),
    staleTime: 1000 * 60 * 10, // Film stocks change rarely
  });
}

export function useCreateFilmStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/api/film-stocks', data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['film-stocks'] }),
  });
}
