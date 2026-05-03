import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useCameras() {
  return useQuery({
    queryKey: ['cameras'],
    queryFn: () => api.get('/api/cameras').then((r) => r.data),
  });
}

export function useCreateCamera() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/api/cameras', data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cameras'] }),
  });
}

export function useUpdateCamera() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/api/cameras/${id}`, data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cameras'] }),
  });
}

export function useDeleteCamera() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/api/cameras/${id}`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cameras'] }),
  });
}
