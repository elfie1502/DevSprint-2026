<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import { login } from '$lib/api';
	import { APP_NAME, APP_TAGLINE, HACKATHON, ORGANIZER, GITHUB_URL } from '$lib/config';
	import { onMount } from 'svelte';
	import toast from 'svelte-5-french-toast';
	import Moon from '@lucide/svelte/icons/moon';
	import Hash from '@lucide/svelte/icons/hash';
	import Lock from '@lucide/svelte/icons/lock';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';

	let studentId = $state('');
	let password = $state('');
	let loading = $state(false);

	onMount(() => {
		if (auth.isLoggedIn) goto('/menu');
	});

	async function handleLogin(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		try {
			const data = await login(studentId, password);
			auth.login(data.token, data.student);
			toast.success(`Welcome back, ${data.student.full_name.split(' ')[0]}!`);
			await goto('/menu');
		} catch (err: any) {
			toast.error(err.error || 'Login failed. Please check your credentials.');
		} finally {
			loading = false;
		}
	}

	function quickFill(type: 'student' | 'admin') {
		if (type === 'student') {
			studentId = '240042141';
			password = 'password';
		} else {
			studentId = 'admin';
			password = 'admin';
		}
	}
</script>

<svelte:head>
	<title>Sign In - {APP_NAME}</title>
</svelte:head>

<div class="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
	<!-- Subtle ambient gradient -->
	<div class="pointer-events-none fixed inset-0 overflow-hidden">
		<div class="absolute top-0 left-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-amber-500/5 blur-3xl"></div>
		<div class="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-amber-600/5 blur-3xl"></div>
	</div>

	<!-- Logo mark -->
	<div class="relative mb-10 flex flex-col items-center gap-3">
		<span class="logo-moon">
			<Moon size={44} fill="currentColor" />
		</span>
		<div class="text-center">
			<h1 class="text-2xl font-bold tracking-tight text-zinc-100">{APP_NAME}</h1>
			<p class="mt-0.5 text-sm text-zinc-500">{APP_TAGLINE} &mdash; {HACKATHON} · {ORGANIZER}</p>
		</div>
	</div>

	<!-- Login card -->
	<div class="glass w-full max-w-sm p-8">
		<h2 class="mb-6 text-lg font-semibold text-zinc-100">Sign in</h2>

		<form onsubmit={handleLogin} class="space-y-4">
			<!-- Student ID -->
			<div>
				<label for="studentId" class="mb-1.5 block text-xs font-medium text-zinc-400">Student ID</label>
				<div class="relative">
					<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
						<Hash size={15} />
					</span>
					<input
						id="studentId"
						type="text"
						bind:value={studentId}
						placeholder="e.g. 240042141"
						class="input input-with-icon"
						required
						autocomplete="username"
					/>
				</div>
			</div>

			<!-- Password -->
			<div>
				<label for="password" class="mb-1.5 block text-xs font-medium text-zinc-400">Password</label>
				<div class="relative">
					<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
						<Lock size={15} />
					</span>
					<input
						id="password"
						type="password"
						bind:value={password}
						placeholder="••••••••"
						class="input input-with-icon"
						required
						autocomplete="current-password"
					/>
				</div>
			</div>

			<button type="submit" class="btn-primary mt-2 w-full" disabled={loading}>
				{#if loading}
					<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900"></span>
					Signing in…
				{:else}
					Sign in
					<ArrowRight size={15} />
				{/if}
			</button>
		</form>

		<!-- Quick fill -->
		<div class="mt-6 border-t border-white/5 pt-5">
			<p class="mb-2.5 text-xs text-zinc-600">Try a demo account</p>
			<div class="flex gap-2">
				<button
					type="button"
					onclick={() => quickFill('student')}
					class="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/8 py-2 text-xs font-medium text-zinc-400 transition-all hover:border-amber-500/20 hover:bg-amber-500/5 hover:text-amber-400"
				>
					<GraduationCap size={13} />
					Student
				</button>
				<button
					type="button"
					onclick={() => quickFill('admin')}
					class="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/8 py-2 text-xs font-medium text-zinc-400 transition-all hover:border-amber-500/20 hover:bg-amber-500/5 hover:text-amber-400"
				>
					<ShieldCheck size={13} />
					Admin
				</button>
			</div>
			<p class="mt-3 text-center text-xs text-zinc-700">
				All seed users are listed on the
				<a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" class="text-zinc-500 underline underline-offset-2 transition-colors hover:text-zinc-300">
					GitHub repository
				</a>
			</p>
		</div>

		<div class="mt-4 text-center">
			<a href="/register" class="text-xs text-zinc-500 transition-colors hover:text-zinc-300">
				Don't have an account? <span class="text-amber-500">Register</span>
			</a>
		</div>
	</div>
</div>
