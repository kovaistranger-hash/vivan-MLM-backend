import { api } from '../services/api';

export async function downloadOrderInvoice(orderId: number) {
  const res = await api.get(`/orders/${orderId}/invoice`, { responseType: 'blob' });
  const cd = res.headers['content-disposition'] as string | undefined;
  let name = `invoice-${orderId}.pdf`;
  if (cd?.includes('filename=')) {
    const m = cd.match(/filename="([^"]+)"/);
    if (m?.[1]) name = m[1];
  }
  const url = window.URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.URL.revokeObjectURL(url);
}
