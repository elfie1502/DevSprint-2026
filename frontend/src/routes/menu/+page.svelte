<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import { api } from '$lib/api';
	import { APP_NAME } from '$lib/config';
	import toast from 'svelte-5-french-toast';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Utensils from '@lucide/svelte/icons/utensils';
	import Coffee from '@lucide/svelte/icons/coffee';
	import Cookie from '@lucide/svelte/icons/cookie';
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import PackageX from '@lucide/svelte/icons/package-x';

	const uuidv4 = () => crypto.randomUUID();

	interface MenuItem {
		id: number;
		name: string;
		description: string;
		emoji: string;
		price: number;
		qty: number;
		category: string;
	}

	let items = $state<MenuItem[]>([]);
	let loading = $state(true);
	let activeCategory = $state('all');
	let ordering = $state<number | null>(null);

	const categories = [
		{ key: 'all', label: 'All', icon: LayoutGrid },
		{ key: 'main', label: 'Mains', icon: Utensils },
		{ key: 'drink', label: 'Drinks', icon: Coffee },
		{ key: 'snack', label: 'Snacks', icon: Cookie }
	];

	onMount(async () => {
		if (!auth.isLoggedIn) {
			goto('/');
			return;
		}
		await loadMenu();
	});

	async function loadMenu() {
		loading = true;
		try {
			const data = await api.getMenu(auth.token!);
			items = data.items;
		} catch (e: any) {
			toast.error(e.error || 'Failed to load menu.');
		} finally {
			loading = false;
		}
	}

	const filtered = $derived(
		activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory)
	);

	async function order(item: MenuItem) {
		if (ordering || item.qty <= 0) return;
		ordering = item.id;
		try {
			const idempotency_key = `${auth.student!.student_id}-${item.id}-${uuidv4()}`;
			const result = await api.placeOrder(auth.token!, item.id, idempotency_key);
			toast.success(`${item.name} ordered!`);
			goto(`/order/${result.order_id}`);
		} catch (e: any) {
			toast.error(e.error || 'Order failed. Please try again.');
		} finally {
			ordering = null;
		}
	}

	function qtyBadgeClass(qty: number) {
		if (qty <= 0) return 'badge-red';
		if (qty <= 10) return 'badge-amber';
		return 'badge-green';
	}
</script>

<svelte:head><title>Menu - {APP_NAME}</title></svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-zinc-100">Menu</h1>
			<p class="mt-0.5 text-sm text-zinc-500">Order for canteen pickup</p>
		</div>
		<button
			onclick={loadMenu}
			class="flex items-center gap-1.5 rounded-lg border border-white/8 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-all hover:bg-white/5 hover:text-zinc-200 {loading
				? 'animate-spin'
				: ''}"
			disabled={loading}
		>
			<RefreshCw size={13} />
			{loading ? '' : 'Refresh'}
		</button>
	</div>

	<!-- Category tabs -->
	<div class="mb-6 flex gap-2 overflow-x-auto pb-1">
		{#each categories as cat}
			<button
				onclick={() => (activeCategory = cat.key)}
				class="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all
				{activeCategory === cat.key
					? 'bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20'
					: 'border border-white/8 text-zinc-400 hover:border-white/15 hover:bg-white/5 hover:text-zinc-200'}"
			>
				<cat.icon size={14} />
				{cat.label}
			</button>
		{/each}
	</div>

	<!-- Grid -->
	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array(6) as _}
				<div class="glass animate-pulse p-6">
					<div class="mb-4 flex justify-between">
						<div class="h-12 w-12 rounded-xl bg-white/5"></div>
						<div class="h-6 w-16 rounded-full bg-white/5"></div>
					</div>
					<div class="mb-2 h-4 w-2/3 rounded-lg bg-white/5"></div>
					<div class="h-3 w-full rounded-lg bg-white/5"></div>
					<div class="mt-4 h-3 w-1/2 rounded-lg bg-white/5"></div>
				</div>
			{/each}
		</div>
	{:else if filtered.length === 0}
		<div class="glass flex flex-col items-center gap-4 py-20 text-center">
			<PackageX size={40} class="text-zinc-600" />
			<p class="text-zinc-400">Nothing in this category yet.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each filtered as item (item.id)}
				<div
					class="glass group flex flex-col gap-4 p-6 transition-all hover:border-amber-500/20 hover:shadow-amber-900/10"
				>
					<!-- Top row -->
					<div class="flex items-start justify-between">
						<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5">
							<span class="text-2xl">
								{item.emoji}
							</span>
						</div>
						<span class="badge {qtyBadgeClass(item.qty)}">
							{item.qty > 0 ? `${item.qty} left` : 'Sold out'}
						</span>
					</div>

					<!-- Info -->
					<div class="flex-1">
						<h3 class="font-semibold text-zinc-100">{item.name}</h3>
						<p class="mt-1 text-sm leading-relaxed text-zinc-500">{item.description}</p>
					</div>

					<!-- Footer -->
					<div class="flex items-center justify-between border-t border-white/5 pt-4">
						<span class="text-lg font-bold text-amber-400">৳{Number(item.price).toFixed(0)}</span>
						<button
							onclick={() => order(item)}
							disabled={item.qty <= 0 || ordering === item.id}
							class="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl
							       bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-400
							       shadow-lg transition-all active:scale-95
							       hover:bg-amber-500 hover:text-zinc-950 hover:shadow-amber-500/30
							       disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if ordering === item.id}
								<span
									class="h-3 w-3 animate-spin rounded-full border border-zinc-900/30 border-t-zinc-900"
								></span>
								Ordering…
							{:else if item.qty <= 0}
								Sold out
							{:else}
								<ShoppingCart size={13} />
								Order
							{/if}
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
