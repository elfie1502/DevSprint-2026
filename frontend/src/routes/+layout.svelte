<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import { APP_NAME } from '$lib/config';
	import { Toaster } from 'svelte-5-french-toast';
	import { fade, fly } from 'svelte/transition';
	import logo from "$lib/assets/logo.png";
	import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
	import Clock from '@lucide/svelte/icons/clock';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import User from '@lucide/svelte/icons/user';
	import LogOut from '@lucide/svelte/icons/log-out';

	let { children } = $props();

	interface NavLink { href: string; label: string; icon: any }

	const studentNavLinks: NavLink[] = [
		{ href: '/menu',    label: 'Menu',    icon: UtensilsCrossed },
		{ href: '/history', label: 'History', icon: Clock },
		{ href: '/profile', label: 'Profile', icon: User }
	];

	const adminNavLinks: NavLink[] = [
		{ href: '/menu',    label: 'Menu',    icon: UtensilsCrossed },
		{ href: '/history', label: 'History', icon: Clock },
		{ href: '/admin',   label: 'Admin',   icon: ShieldCheck },
		{ href: '/profile', label: 'Profile', icon: User }
	];

	const navLinks = $derived(auth.isAdmin ? adminNavLinks : studentNavLinks);
	const pathname = $derived(page.url.pathname);

	function isActive(href: string) {
		if (href === '/menu') return pathname.startsWith('/menu') || pathname.startsWith('/order');
		return pathname.startsWith(href);
	}
</script>

<svelte:head>
	<title>{APP_NAME}</title>
</svelte:head>

<!-- Desktop sticky header (hidden on mobile, replaced by bottom tab) -->
{#if auth.isLoggedIn}
	<header class="sticky top-0 z-50 hidden border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl lg:block">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
			<!-- Logo -->
			<a href="/menu" class="flex items-center gap-2.5 text-base font-bold tracking-tight">
				<img src={logo} alt="logo" class="h-12 w-12" />
				<span class="text-zinc-100">{APP_NAME}</span>
			</a>

			<!-- Desktop nav links -->
			<nav class="flex items-center gap-1">
				{#each navLinks.filter(l => l.href !== '/profile') as link}
					<a
						href={link.href}
						class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all
						{isActive(link.href)
							? 'bg-amber-500/10 text-amber-400'
							: 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'}"
					>
						<link.icon size={15} />
						{link.label}
					</a>
				{/each}
			</nav>

			<!-- Avatar -->
			<div class="flex items-center gap-2">
				<a href="/profile" class="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-all hover:bg-white/5">
					<img
						src="https://api.dicebear.com/9.x/thumbs/svg?seed={auth.student?.avatar_seed}&backgroundColor=27272a"
						alt="avatar"
						class="h-8 w-8 rounded-full border border-white/10"
					/>
					<div>
						<p class="text-sm font-semibold leading-none text-zinc-100">{auth.student?.full_name}</p>
						<p class="mt-0.5 text-xs text-zinc-500">{auth.student?.department} · {auth.student?.batch}</p>
					</div>
				</a>
			</div>
		</div>
	</header>
{/if}

<!-- Main content with page transitions -->
<main class="min-h-screen {auth.isLoggedIn ? 'pb-20 lg:pb-0' : ''}">
	{#key pathname}
		<div
			in:fly={{ y: 14, duration: 230, delay: 110 }}
			out:fade={{ duration: 100 }}
		>
			{@render children()}
		</div>
	{/key}
</main>

<!-- Mobile bottom tab bar -->
{#if auth.isLoggedIn}
	<nav class="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-zinc-950/90 backdrop-blur-xl lg:hidden">
		<div class="flex items-center justify-around px-2 py-2">
			{#each navLinks as link}
				<a
					href={link.href}
					class="flex flex-col items-center gap-1 rounded-xl px-4 py-2 text-xs font-medium transition-all
					{isActive(link.href)
						? 'text-amber-400'
						: 'text-zinc-500 hover:text-zinc-300'}"
				>
					<span class="transition-transform {isActive(link.href) ? 'scale-110' : ''}">
						<link.icon size={20} />
					</span>
					{link.label}
				</a>
			{/each}
		</div>
	</nav>
{/if}

<Toaster position="top-right" />
