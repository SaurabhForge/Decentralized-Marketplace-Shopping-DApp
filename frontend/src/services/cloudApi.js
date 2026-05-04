const apiBaseUrl = (import.meta.env.VITE_API_URL || import.meta.env.VITE_GCP_API_URL || "").replace(/\/$/, "");

const requestJson = async (path, options = {}) => {
  if (!apiBaseUrl) {
    return null;
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Cloud API request failed with ${response.status}`);
  }

  return response.json();
};

export const getCloudApiUrl = () => apiBaseUrl || "";

export const fetchCloudConfig = () => requestJson("/api/config");

export const fetchFeaturedProducts = () => requestJson("/api/products/featured");

export const fetchHostedOrders = (account) => (
  account ? requestJson(`/api/orders/${account}`) : null
);

export const createHostedOrder = (order) => requestJson("/api/orders", {
  method: "POST",
  body: JSON.stringify(order),
});

export const publishAnalyticsEvent = (event) => requestJson("/api/analytics/purchase", {
  method: "POST",
  body: JSON.stringify(event),
});
