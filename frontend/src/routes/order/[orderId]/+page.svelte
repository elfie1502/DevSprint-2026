<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import { api, NOTIF } from '$lib/api';
	import { APP_NAME } from '$lib/config';
	import toast from 'svelte-5-french-toast';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Clock from '@lucide/svelte/icons/clock';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import Bell from '@lucide/svelte/icons/bell';
	import Check from '@lucide/svelte/icons/check';
	import Utensils from '@lucide/svelte/icons/utensils';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';

	const orderId = $derived($page.params.orderId);

	interface Order {
		id: string;
		student_name: string;
		item_name: string;
		item_emoji: string;
		item_price: number;
		status: string;
		created_at: string;
	}

	const STATUS_STEPS = ['Pending', 'In Kitchen', 'Ready'];

	let order = $state<Order | null>(null);
	let loading = $state(true);
	let error = $state('');
	let events: EventSource | null = null;
	let notifiedReady = $state(false);

	onMount(async () => {
		if (!auth.isLoggedIn) { goto('/'); return; }
		if (!orderId) { goto('/history'); return; }
		try {
			order = await api.getOrder(auth.token!, orderId);
		} catch (e: any) {
			error = e.error || 'Order not found.';
			loading = false;
			return;
		}
		loading = false;
		if (order?.status !== 'Ready') connectSSE();
	});

	onDestroy(() => events?.close());

	function connectSSE() {
		events = new EventSource(`${NOTIF}/events/${orderId}`);
		events.addEventListener('status', (e) => {
			const data = JSON.parse(e.data);
			if (order) order = { ...order, status: data.status };
			if (data.status === 'Ready') {
				events?.close();
				if (!notifiedReady) {
					notifiedReady = true;
					toast.success('Your order is ready for pickup!');
				}
			}
		});
		events.onerror = () => {
			setTimeout(() => { if (order?.status !== 'Ready') connectSSE(); }, 3000);
		};
	}

	const stepIndex = $derived(STATUS_STEPS.indexOf(order?.status ?? 'Pending'));

	const stepMeta = [
		{ label: 'Pending',    icon: Clock   },
		{ label: 'In Kitchen', icon: ChefHat },
		{ label: 'Ready',      icon: Bell    }
	];

	function statusBadgeClass(status: string) {
		if (status === 'Ready') return 'badge-green';
		if (status === 'In Kitchen') return 'badge-blue';
		return 'badge-amber';
	}
</script>

<svelte:head><title>Order Tracker - {APP_NAME}</title></svelte:head>

<div class="mx-auto max-w-lg px-4 py-8 sm:px-6">
	<a href="/menu" class="mb-8 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-200">
		<ChevronLeft size={16} />
		Back to menu
	</a>

	{#if loading}
		<div class="glass animate-pulse space-y-4 p-8">
			<div class="h-5 w-1/2 rounded-lg bg-white/5"></div>
			<div class="h-4 w-1/3 rounded-lg bg-white/5"></div>
			<div class="mt-6 h-2 w-full rounded-full bg-white/5"></div>
		</div>
	{:else if error}
		<div class="glass border-red-500/20 bg-red-500/5 p-8 text-center text-sm text-red-400">{error}</div>
	{:else if order}
		<!-- Order card -->
		<div class="glass mb-5 p-6">
			<!-- Item header -->
			<div class="mb-6 flex items-center gap-4">
				<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-zinc-500">
					<Utensils size={24} />
				</div>
				<div>
					<h2 class="text-xl font-bold text-zinc-100">{order.item_name}</h2>
					<p class="text-sm text-zinc-500">for {order.student_name}</p>
					<p class="mt-0.5 text-sm font-semibold text-amber-400">৳{Number(order.item_price).toFixed(0)}</p>
				</div>
				<div class="ml-auto">
					<span class="badge {statusBadgeClass(order.status)}">{order.status}</span>
				</div>
			</div>

			{#if order.status !== 'Ready'}
				<!-- Animated waiting indicator -->
				<div class="mb-6 flex items-center gap-3 rounded-xl border border-white/5 bg-white/3 px-4 py-3">
					<span class="flex gap-1">
						{#each [0,1,2] as i}
							<span class="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" style="animation-delay: {i * 150}ms"></span>
						{/each}
					</span>
					<span class="text-sm text-zinc-400">Waiting for update…</span>
				</div>
			{/if}

			<!-- Step progress -->
			<div class="relative">
				<!-- Track line -->
				<div class="absolute top-5 left-5 right-5 h-px bg-white/8">
					<div
						class="h-full bg-amber-500 transition-all duration-700 ease-in-out"
						style="width: {stepIndex === 0 ? '0%' : stepIndex === 1 ? '50%' : '100%'}"
					></div>
				</div>

				<div class="relative flex justify-between">
					{#each stepMeta as step, i}
						<div class="flex flex-col items-center gap-2">
							<div
								class="z-10 flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-500
								{i < stepIndex
									? 'border-amber-500 bg-amber-500 text-zinc-950'
									: i === stepIndex
										? 'border-amber-500 bg-amber-500/20 text-amber-400 shadow-lg shadow-amber-500/20'
										: 'border-white/10 bg-zinc-900 text-zinc-600'}"
							>
								{#if i < stepIndex}
									<Check size={16} />
								{:else}
									<step.icon size={16} />
								{/if}
							</div>
							<span class="text-xs {i <= stepIndex ? 'text-zinc-300' : 'text-zinc-600'}">{step.label}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>

		{#if order.status === 'Ready'}
			<!-- Ready state card -->
			<div class="glass border-green-500/20 bg-green-500/5 p-8 text-center">
				<div class="mb-3 flex justify-center">
					<div class="flex h-16 w-16 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10 text-green-400">
						<Check size={32} />
					</div>
				</div>
				<h3 class="text-lg font-semibold text-green-400">Ready for pickup!</h3>
				<p class="mt-1 text-sm text-zinc-400">Head to the canteen counter to collect your order.</p>
				<a href="/menu" class="btn-primary mt-6 inline-flex">
					<ShoppingBag size={15} />
					Order again
				</a>
			</div>
		{/if}

		<p class="mt-4 text-center text-xs text-zinc-700">Order #{order.id.slice(0, 8).toUpperCase()}</p>
	{/if}
</div>
