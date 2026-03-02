<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import { api } from '$lib/api';
	import { APP_NAME } from '$lib/config';
	import Utensils from '@lucide/svelte/icons/utensils';
	import PackageX from '@lucide/svelte/icons/package-x';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';

	interface Order {
		id: string;
		item_name: string;
		item_emoji: string;
		item_price: number;
		status: string;
		created_at: string;
		updated_at: string;
	}

	let orders = $state<Order[]>([]);
	let loading = $state(true);

	onMount(async () => {
		if (!auth.isLoggedIn) { goto('/'); return; }
		try {
			const data = await api.getOrderHistory(auth.token!);
			orders = data.orders;
		} catch {
			// silent
		} finally {
			loading = false;
		}
	});

	function statusBadgeClass(status: string) {
		if (status === 'Ready') return 'badge-green';
		if (status === 'In Kitchen') return 'badge-blue';
		return 'badge-amber';
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleString('en-BD', {
			day: '2-digit', month: 'short', year: 'numeric',
			hour: '2-digit', minute: '2-digit', hour12: true
		});
	}
</script>

<svelte:head>
	<title>History - {APP_NAME}</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-8 sm:px-6">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-zinc-100">Order History</h1>
			<p class="mt-0.5 text-sm text-zinc-500">All your past orders</p>
		</div>
		{#if !loading && orders.length > 0}
			<span class="badge-zinc">{orders.length} order{orders.length !== 1 ? 's' : ''}</span>
		{/if}
	</div>

	{#if loading}
		<div class="space-y-3">
			{#each Array(5) as _}
				<div class="glass h-20 animate-pulse"></div>
			{/each}
		</div>
	{:else if orders.length === 0}
		<div class="glass flex flex-col items-center gap-4 py-20 text-center">
			<PackageX size={40} class="text-zinc-600" />
			<div>
				<p class="font-semibold text-zinc-300">No orders yet</p>
				<p class="mt-1 text-sm text-zinc-500">Place your first order from the menu.</p>
			</div>
			<a href="/menu" class="btn-primary">
				<ShoppingBag size={15} />
				Browse Menu
			</a>
		</div>
	{:else}
		<div class="space-y-2">
			{#each orders as order}
				<a
					href="/order/{order.id}"
					class="glass flex items-center justify-between gap-4 p-4 transition-all hover:border-amber-500/15 hover:bg-white/5"
				>
					<div class="flex items-center gap-3.5">
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-500">
							<Utensils size={16} />
						</div>
						<div>
							<p class="font-semibold text-zinc-100">{order.item_name}</p>
							<p class="mt-0.5 text-xs text-zinc-500">{formatDate(order.created_at)}</p>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<div class="flex flex-col items-end gap-1.5">
							<span class="badge {statusBadgeClass(order.status)}">{order.status}</span>
							<span class="text-sm font-bold text-amber-400">৳{Number(order.item_price).toFixed(0)}</span>
						</div>
						<ChevronRight size={16} class="text-zinc-600" />
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
