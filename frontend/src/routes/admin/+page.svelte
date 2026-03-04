<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import { api, GATEWAY } from '$lib/api';
	import { APP_NAME } from '$lib/config';
	import toast from 'svelte-5-french-toast';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Activity from '@lucide/svelte/icons/activity';
	import Database from '@lucide/svelte/icons/database';
	import BellRing from '@lucide/svelte/icons/bell-ring';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Package from '@lucide/svelte/icons/package';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import Zap from '@lucide/svelte/icons/zap';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Timer from '@lucide/svelte/icons/timer';
	import Skull from '@lucide/svelte/icons/skull';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';

	interface ServiceHealth { service: string; status: string; }
	interface HealthData { status: string; redis: string; downstream: ServiceHealth[]; }
	interface MetricsData { gateway: any; downstream: any[]; }

	let health = $state<HealthData | null>(null);
	let metrics = $state<MetricsData | null>(null);
	let loading = $state(true);
	let refreshing = $state(false);
	let consecutiveHighLatency = $state(0);
	let latencyAlert = $state(false);
	let interval: ReturnType<typeof setInterval>;

	onMount(async () => {
		if (!auth.isLoggedIn) { goto('/'); return; }
		if (!auth.isAdmin) { goto('/menu'); return; }
		await refresh();
		interval = setInterval(refresh, 5000);
	});
	onDestroy(() => clearInterval(interval));

	async function refresh() {
		refreshing = true;
		try {
			const [h, m] = await Promise.all([api.getHealth(), api.getMetrics()]);
			health = h;
			metrics = m;
			loading = false;
			const lat = m?.gateway?.latency_avg_ms ?? 0;
			if (lat > 1000) {
				consecutiveHighLatency++;
				if (consecutiveHighLatency >= 2) {
					latencyAlert = true;
					toast.error(`High latency detected: ${lat}ms`);
				}
			} else {
				consecutiveHighLatency = 0;
				latencyAlert = false;
			}
		} catch { /* gateway may be down */ } finally {
			refreshing = false;
		}
	}

	async function sendChaos(service: string, label: string) {
		// Optimistically mark the service as down immediately so the UI updates right away.
		// The gateway uses names like "notification-hub", "stock-service", etc. — all start with the chaos key.
		if (health) {
			health = {
				...health,
				status: 'degraded',
				downstream: health.downstream.map(s =>
					s.service.startsWith(service) ? { ...s, status: 'down' } : s
				)
			};
		}
		try {
			const res = await fetch(`${GATEWAY}/chaos/kill/${service}`, {
				headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {}
			});
			const data = await res.json();
			toast.success(data.message || `${label} signal sent.`);
		} catch {
			toast.error(`${label} may already be down.`);
		}
		setTimeout(refresh, 1500);
	}

	async function seedStock() {
		try {
			await api.seedStock(auth.token!);
			toast.success('Stock reset to defaults!');
		} catch {
			toast.error('Failed to reset stock.');
		}
	}

	function statusDotClass(s: string) {
		return s === 'ok' ? 'bg-green-400' : s === 'down' ? 'bg-red-500 animate-pulse' : 'bg-amber-400';
	}
	function statusTextClass(s: string) {
		return s === 'ok' ? 'text-green-400' : s === 'down' ? 'text-red-400' : 'text-amber-400';
	}

	const serviceIcons: Record<string, any> = {
		redis: Database,
		stock: Package,
		kitchen: ChefHat,
		notification: BellRing,
		identity: ShieldCheck
	};

	const chaosTargets = [
		{ key: 'stock',        label: 'Stock',        icon: Package   },
		{ key: 'kitchen',      label: 'Kitchen',      icon: ChefHat   },
		{ key: 'notification', label: 'Notif Hub',    icon: BellRing  },
		{ key: 'identity',     label: 'Identity',     icon: ShieldCheck }
	];

	const allServices = $derived([
		...(health ? [{ service: 'redis', status: health.redis }] : []),
		...(health?.downstream ?? [])
	]);
</script>

<svelte:head><title>Admin - {APP_NAME}</title></svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-zinc-100">Admin Dashboard</h1>
			<p class="mt-0.5 text-sm text-zinc-500">System health · Metrics · Chaos Engineering</p>
		</div>
		<button
			onclick={refresh}
			disabled={refreshing}
			class="flex items-center gap-1.5 rounded-lg border border-white/8 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-all hover:bg-white/5 hover:text-zinc-200"
		>
			<RefreshCw size={13} class={refreshing ? 'animate-spin' : ''} />
			Refresh
		</button>
	</div>

	<!-- Service Health -->
	<section class="mb-6">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-600">Service Health</h2>
		{#if loading}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
				{#each Array(5) as _}
					<div class="glass h-20 animate-pulse"></div>
				{/each}
			</div>
		{:else}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
				{#each allServices as svc}
					{@const Icon = serviceIcons[svc.service] ?? Activity}
					<div class="glass flex flex-col gap-2.5 p-4">
						<div class="flex items-center justify-between">
							<Icon size={15} class="text-zinc-500" />
							<span class="status-dot {statusDotClass(svc.status)}"></span>
						</div>
						<div>
							<p class="text-xs text-zinc-500 capitalize">{svc.service}</p>
							<p class="text-sm font-bold {statusTextClass(svc.status)}">{svc.status.toUpperCase()}</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Metrics -->
	{#if metrics}
		{@const gw = metrics.gateway}
		<section class="mb-6">
			<h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-600">Gateway Metrics</h2>
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{#each [
					{ label: 'Orders', value: gw.orders_processed, icon: TrendingUp, color: 'text-green-400' },
					{ label: 'Cache Hits', value: gw.cache_hits, icon: Zap, color: 'text-amber-400' },
					{ label: 'Failures', value: gw.failures, icon: AlertTriangle, color: 'text-red-400' },
					{ label: 'Avg Latency', value: `${gw.latency_avg_ms ?? 0}ms`, icon: Timer, color: latencyAlert ? 'text-red-400' : 'text-blue-400' }
				] as m}
					<div class="glass p-4">
						<div class="mb-2 flex items-center gap-1.5">
							<m.icon size={13} class={m.color} />
							<span class="text-xs text-zinc-500">{m.label}</span>
						</div>
						<p class="text-2xl font-bold text-zinc-100">{m.value}</p>
					</div>
				{/each}
			</div>

			<!-- Downstream metrics -->
			{#if metrics.downstream.filter(d => !d.error).length > 0}
				<div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
					{#each metrics.downstream.filter(d => !d.error) as svc}
						<div class="glass p-4">
							<p class="mb-3 text-sm font-semibold capitalize text-zinc-300">{svc.service}</p>
							<dl class="grid grid-cols-2 gap-2">
								{#each Object.entries(svc).filter(([k]) => !['service', 'error'].includes(k)) as [k, v]}
									<div class="rounded-lg bg-white/4 px-3 py-2">
										<dt class="text-xs text-zinc-500">{k.replace(/_/g, ' ')}</dt>
										<dd class="mt-0.5 font-semibold text-zinc-200">{v}</dd>
									</div>
								{/each}
							</dl>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	<!-- Chaos Engineering -->
	<section>
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-600">Chaos Engineering</h2>
		<div class="glass border-red-500/10 p-5">
			<p class="mb-4 text-sm text-zinc-500">
				Kill a downstream service to test resilience. Services auto-restart via Docker compose.
			</p>
			<div class="flex flex-wrap items-center gap-3">
				{#each chaosTargets as t}
					<button
						onclick={() => sendChaos(t.key, t.label)}
						class="flex items-center gap-2 rounded-xl border border-red-500/20 px-4 py-2.5 text-sm font-medium text-red-400 transition-all hover:bg-red-500/10 active:scale-95"
					>
						<Skull size={14} />
						Kill {t.label}
					</button>
				{/each}
				<button
					onclick={seedStock}
					class="ml-auto flex items-center gap-2 rounded-xl border border-white/8 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-all hover:bg-white/5 active:scale-95"
				>
					<RotateCcw size={14} />
					Reset Stock
				</button>
			</div>
		</div>
	</section>
</div>
