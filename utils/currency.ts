const indianCurrency = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2,
});

export const formatCurrency = (value: number) => indianCurrency.format(value);
