import { useEffect, useMemo, useState } from 'react';

type Price = { amountCents: number; currency: string; isStartingAt?: boolean };
type StoreItem = { id: number; logoUrl?: string; slug: string; name: string; description: string; category: string; status: string; availabilityMessage?: string; productType: string; documentationUrl?: string; featured: boolean; setupEligible: boolean; includedProductSlugs: string[]; requirements: string[]; externalIntegrations: string[]; badges: Record<string, boolean>; price: Price | null; sale?: { badge?: string; amountCents: number; savingsCents: number; endsAt: string }; purchasable: boolean };

const money = (cents = 0, currency = 'usd') => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);

export default function CommerceCatalogue() {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [cart, setCart] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [couponCode, setCouponCode] = useState('');

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('kl-store-cart') || '[]');
    setCart(Array.isArray(saved) ? saved : []);
    fetch('/api/store/catalog').then((response) => response.json()).then((data) => setItems(data.items || [])).catch(() => setMessage('The live store catalogue is temporarily unavailable.')).finally(() => setLoading(false));
  }, []);
  useEffect(() => localStorage.setItem('kl-store-cart', JSON.stringify(cart)), [cart]);

  const products = items.filter((item) => ['software', 'bundle'].includes(item.productType));
  const services = items.filter((item) => item.productType === 'setup_service');
  const categories = ['All', ...Array.from(new Set(products.map((item) => item.category)))];
  const visible = useMemo(() => products.filter((item) => (filter === 'All' || item.category === filter) && `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(query.toLowerCase())), [products, filter, query]);
  const cartItems = items.filter((item) => cart.includes(item.slug));
  const productSlugs = cartItems.filter((item) => item.productType !== 'setup_service').map((item) => item.slug);
  const setupServiceSlugs = cartItems.filter((item) => item.productType === 'setup_service').map((item) => item.slug);
  const cartTotal = cartItems.reduce((sum, item) => sum + (item.sale?.amountCents ?? item.price?.amountCents ?? 0), 0);
  const add = (slug: string) => setCart((current) => current.includes(slug) ? current : [...current, slug]);
  const remove = (slug: string) => setCart((current) => current.filter((item) => item !== slug));

  const checkout = async (extra: Record<string, unknown> = {}) => {
    setCheckingOut(true); setMessage('');
    const auth = await fetch('/api/auth/session').then((response) => response.json()).catch(() => ({ authenticated: false }));
    if (!auth.authenticated) { location.href = `/api/auth/discord?action=login&returnTo=${encodeURIComponent('/products/')}`; return; }
    const response = await fetch('/api/store/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': auth.csrfToken }, body: JSON.stringify({ productSlugs, setupServiceSlugs, couponCode: couponCode.trim() || undefined, ...extra }) });
    const data = await response.json();
    if (response.ok && data.checkoutUrl) { location.href = data.checkoutUrl; return; }
    if (data.code === 'bundle_conflict') {
      const replace = window.confirm('The Complete Bot Bundle already includes all five bot products. Select OK to replace individual bots with the bundle, or Cancel to keep individual products.');
      await checkout({ ...extra, bundleChoice: replace ? 'replace' : 'keep' }); return;
    }
    if (data.code === 'existing_entitlement') {
      if (window.confirm('You already own one or more selected products. Continue and purchase them again?')) { await checkout({ ...extra, acknowledgeOwned: true }); return; }
    }
    setMessage(data.error || 'Unable to start checkout.'); setCheckingOut(false);
  };

  return <div className="storefront">
    <div className="store-tools">
      <label className="store-search"><span>Search store</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products and bundles" /></label>
      <div className="store-filters">{categories.map((category) => <button key={category} className={filter === category ? 'active' : ''} onClick={() => setFilter(category)}>{category}</button>)}</div>
      <button className="store-cart-button" onClick={() => document.querySelector('#store-cart')?.scrollIntoView({ behavior: 'smooth' })}>Cart <strong>{cart.length}</strong></button>
    </div>
    {message && <div className="store-message">{message}</div>}
    {loading ? <div className="store-grid">{[1,2,3].map((item) => <div className="store-card skeleton" key={item} />)}</div> : <div className="store-grid">{visible.map((item) => <article className={`store-card ${item.featured ? 'featured' : ''}`} key={item.slug}>
      <div className="store-card-top"><span className="store-status">{item.status === 'active' ? 'Available' : item.status.replaceAll('_', ' ')}</span><span className="store-category">{item.category}</span></div>
      {item.slug === 'complete-bot-bundle' && <div className="bundle-ribbon">Save about $45</div>}
      <div className="store-image">{item.logoUrl ? <img src={item.logoUrl} alt="" loading="lazy" /> : <span>{item.name.split(/\s+/).map((word) => word[0]).join('').slice(0, 3)}</span>}</div><h3>{item.name}</h3><p>{item.description}</p>
      <div className="store-price">{item.price?.isStartingAt && <small>Starting at</small>}{item.sale ? <><del>{money(item.price?.amountCents, item.price?.currency)}</del><strong>{money(item.sale.amountCents, item.price?.currency)}</strong><span>Save {money(item.sale.savingsCents)}</span></> : <strong>{money(item.price?.amountCents, item.price?.currency)}</strong>}</div>
      <div className="store-badges"><span>One Time Purchase</span><span>Self Hosted</span><span>Source Included</span><span>No Monthly Software License Fee</span></div>
      <div className="store-actions"><a href={`/products/${item.slug}/`}>View Product</a><a href={item.documentationUrl || '/docs/'}>Documentation</a><button disabled={!item.purchasable || cart.includes(item.slug)} onClick={() => add(item.slug)}>{cart.includes(item.slug) ? 'In Cart' : item.purchasable ? 'Buy Now' : 'Currently Unavailable'}</button></div>
    </article>)}</div>}
    <section className="store-services"><div><span className="store-kicker">Optional implementation</span><h2>Setup services</h2><p>Choose only the work you need. Customer-owned credentials stay private, and custom backend development is quoted separately.</p></div><div className="service-grid">{services.map((service) => <article key={service.slug}><h3>{service.name}</h3><p>{service.description}</p><strong>{service.price?.isStartingAt ? 'Starting at ' : ''}{money(service.price?.amountCents)}</strong><button disabled={!service.purchasable || cart.includes(service.slug)} onClick={() => add(service.slug)}>{cart.includes(service.slug) ? 'Added' : 'Add to Cart'}</button></article>)}</div></section>
    <section className="store-cart" id="store-cart"><div><span className="store-kicker">Secure checkout</span><h2>Your cart</h2><p>Payment details are entered on Stripe Checkout. Kruiger Labs does not store raw card numbers or CVC values.</p></div>{cartItems.length ? <><div className="cart-lines">{cartItems.map((item) => <div key={item.slug}><span><strong>{item.name}</strong><small>{item.productType === 'setup_service' ? 'Setup service' : 'Digital software'}</small></span><span>{money(item.sale?.amountCents ?? item.price?.amountCents)} <button onClick={() => remove(item.slug)}>Remove</button></span></div>)}</div><label className="coupon-entry"><span>Coupon code</span><input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="Enter a code if one was issued" /></label><div className="cart-total"><span>Total before Stripe discounts</span><strong>{money(cartTotal)}</strong></div><button className="checkout-button" disabled={checkingOut} onClick={() => checkout()}>{checkingOut ? 'Preparing Stripe Checkout…' : 'Continue to Secure Checkout'}</button></> : <div className="cart-empty">Your cart is empty. Add a product or setup service to begin.</div>}</section>
    <style>{`
      .storefront{display:grid;gap:34px}.store-tools{display:grid;grid-template-columns:minmax(260px,1fr) auto auto;align-items:end;gap:16px;padding:18px;border:1px solid var(--kl-border);border-radius:16px;background:rgba(13,13,18,.74)}.store-search span,.store-kicker{display:block;margin-bottom:7px;color:var(--kl-purple-text,#c4a9fd);font-size:.72rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.store-search input{width:100%;padding:12px 14px;border:1px solid var(--kl-border);border-radius:10px;background:#0b0b10;color:white}.store-filters{display:flex;flex-wrap:wrap;gap:7px}.store-filters button,.store-cart-button{padding:10px 12px;border:1px solid var(--kl-border);border-radius:9px;background:#121219;color:#aaa;cursor:pointer}.store-filters button.active{color:#fff;border-color:#8b5cf6;background:rgba(139,92,246,.16)}.store-cart-button strong{display:inline-grid;place-items:center;min-width:22px;height:22px;margin-left:7px;border-radius:50%;background:#8b5cf6;color:white}.store-message{padding:13px 16px;border:1px solid #ffcc66;border-radius:10px;background:rgba(255,204,102,.07)}.store-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.store-card{position:relative;display:flex;flex-direction:column;min-height:430px;padding:22px;border:1px solid var(--kl-border);border-radius:18px;background:linear-gradient(145deg,rgba(21,21,29,.94),rgba(10,10,14,.9));overflow:hidden}.store-card.featured{border-color:rgba(168,85,247,.48)}.store-card-top{display:flex;justify-content:space-between;gap:10px;color:#a1a1aa;font-size:.75rem}.store-status{color:#6ee7b7}.bundle-ribbon{position:absolute;right:-38px;top:50px;width:170px;transform:rotate(35deg);padding:6px;text-align:center;background:#8b5cf6;color:#fff;font-size:.72rem;font-weight:800}.store-image{display:grid;place-items:center;width:64px;height:64px;margin-top:22px;border:1px solid rgba(168,85,247,.25);border-radius:14px;background:rgba(168,85,247,.08);color:#d8c6ff;font-weight:800}.store-image img{max-width:48px;max-height:48px;object-fit:contain}.store-card h3{margin:16px 0 10px;font-size:1.35rem}.store-card p{color:#aaa}.store-price{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;margin:14px 0}.store-price strong{font-size:1.65rem}.store-price del{color:#777}.store-price span{color:#6ee7b7;font-size:.78rem}.store-price small{width:100%;color:#aaa}.store-badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px}.store-badges span{padding:5px 7px;border:1px solid rgba(168,85,247,.22);border-radius:6px;color:#c5c5ce;font-size:.68rem}.store-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:auto}.store-actions a,.store-actions button,.service-grid button{padding:9px 10px;border:1px solid var(--kl-border);border-radius:8px;background:rgba(255,255,255,.025);color:#eee;text-align:center;text-decoration:none;cursor:pointer}.store-actions button{grid-column:1/-1;background:linear-gradient(135deg,#8b5cf6,#6d28d9);border:0}.store-actions button:disabled,.service-grid button:disabled{opacity:.48;cursor:not-allowed}.skeleton{min-height:430px;animation:pulse 1.5s infinite alternate}@keyframes pulse{to{opacity:.45}}.store-services,.store-cart{display:grid;grid-template-columns:minmax(220px,.55fr) minmax(0,1.45fr);gap:28px;padding:clamp(24px,4vw,42px);border:1px solid var(--kl-border);border-radius:20px;background:rgba(13,13,18,.68)}.store-services h2,.store-cart h2{margin:0 0 8px}.store-services p,.store-cart p{color:#aaa}.service-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.service-grid article{display:grid;grid-template-columns:1fr auto;gap:8px;padding:16px;border:1px solid rgba(168,85,247,.16);border-radius:12px;background:#111118}.service-grid h3,.service-grid p{grid-column:1/-1;margin:0}.service-grid h3{font-size:1rem}.service-grid p{font-size:.82rem}.cart-lines{display:grid}.cart-lines>div{display:flex;justify-content:space-between;gap:20px;padding:13px 0;border-bottom:1px solid var(--kl-border)}.cart-lines small{display:block;color:#888}.cart-lines button{margin-left:10px;border:0;background:transparent;color:#c4a9fd;cursor:pointer}.coupon-entry{display:grid;gap:7px;margin-top:16px}.coupon-entry span{color:#aaa;font-size:.78rem}.coupon-entry input{padding:11px;border:1px solid var(--kl-border);border-radius:8px;background:#09090e;color:#fff;text-transform:uppercase}.cart-total{display:flex;justify-content:space-between;padding:18px 0;font-size:1.15rem}.checkout-button{width:100%;padding:14px;border:0;border-radius:10px;background:linear-gradient(135deg,#a855f7,#6d28d9);color:#fff;font-weight:800;cursor:pointer}.cart-empty{padding:30px;border:1px dashed var(--kl-border);border-radius:12px;color:#888}.store-message{color:#fff}@media(max-width:1050px){.store-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.store-tools{grid-template-columns:1fr}.store-services,.store-cart{grid-template-columns:1fr}}@media(max-width:650px){.store-grid,.service-grid{grid-template-columns:1fr}.store-card{min-height:0}.store-tools{padding:14px}.store-services,.store-cart{padding:20px}.cart-lines>div{align-items:flex-start;flex-direction:column}}
    `}</style>
  </div>;
}

