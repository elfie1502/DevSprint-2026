<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import { api } from '$lib/api';
	import { APP_NAME, HACKATHON, ORGANIZER } from '$lib/config';
	import { onMount } from 'svelte';
	import toast from 'svelte-5-french-toast';
	import Moon from '@lucide/svelte/icons/moon';
	import Hash from '@lucide/svelte/icons/hash';
	import UserRound from '@lucide/svelte/icons/user-round';
	import Building2 from '@lucide/svelte/icons/building-2';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import Lock from '@lucide/svelte/icons/lock';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';

	let studentId = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let fullName = $state('');
	let department = $state('');
	let batch = $state('');
	let loading = $state(false);

	onMount(() => {
		if (auth.isLoggedIn) goto('/menu');
	});

	async function handleRegister(e: SubmitEvent) {
		e.preventDefault();

		if (password !== confirmPassword) {
			toast.error('Passwords do not match.');
			return;
		}
		if (password.length < 6) {
			toast.error('Password must be at least 6 characters.');
			return;
		}

		loading = true;
		try {
			await api.register(studentId, password, fullName, department, batch);
			toast.success('Account created! Redirecting to login…');
			setTimeout(() => goto('/'), 1800);
		} catch (err: any) {
			toast.error(err.error || 'Registration failed. Please try again.');
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Register - {APP_NAME}</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center px-4 py-12">
	<!-- Ambient glow -->
	<div class="pointer-events-none fixed inset-0 overflow-hidden">
		<div class="absolute top-0 left-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-amber-500/5 blur-3xl"></div>
	</div>

	<!-- Logo -->
	<div class="relative mb-8 flex flex-col items-center gap-3">
		<span class="logo-moon">
			<Moon size={40} fill="currentColor" />
		</span>
		<div class="text-center">
			<h1 class="text-xl font-bold tracking-tight text-zinc-100">{APP_NAME}</h1>
			<p class="text-xs text-zinc-600">{HACKATHON} · {ORGANIZER}</p>
		</div>
	</div>

	<!-- Card -->
	<div class="glass w-full max-w-sm p-8">
		<h2 class="mb-6 text-lg font-semibold text-zinc-100">Create an account</h2>

		<form onsubmit={handleRegister} class="space-y-4">
			<!-- Student ID -->
			<div>
				<label for="studentId" class="mb-1.5 block text-xs font-medium text-zinc-400">Student ID</label>
				<div class="relative">
					<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><Hash size={15} /></span>
					<input id="studentId" type="text" bind:value={studentId} placeholder="e.g. 240042141" class="input input-with-icon" required autocomplete="username" />
				</div>
			</div>

			<!-- Full Name -->
			<div>
				<label for="fullName" class="mb-1.5 block text-xs font-medium text-zinc-400">Full Name</label>
				<div class="relative">
					<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><UserRound size={15} /></span>
					<input id="fullName" type="text" bind:value={fullName} placeholder="e.g. Mumtahina Marium" class="input input-with-icon" required autocomplete="name" />
				</div>
			</div>

			<!-- Department + Batch -->
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label for="department" class="mb-1.5 block text-xs font-medium text-zinc-400">Department</label>
					<div class="relative">
						<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><Building2 size={14} /></span>
						<input id="department" type="text" bind:value={department} placeholder="e.g. SWE" class="input input-with-icon" required />
					</div>
				</div>
				<div>
					<label for="batch" class="mb-1.5 block text-xs font-medium text-zinc-400">Batch</label>
					<div class="relative">
						<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><GraduationCap size={14} /></span>
						<input id="batch" type="text" bind:value={batch} placeholder="e.g. 24" class="input input-with-icon" required />
					</div>
				</div>
			</div>

			<!-- Password -->
			<div>
				<label for="password" class="mb-1.5 block text-xs font-medium text-zinc-400">Password</label>
				<div class="relative">
					<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><Lock size={15} /></span>
					<input id="password" type="password" bind:value={password} placeholder="Min. 6 characters" class="input input-with-icon" required autocomplete="new-password" />
				</div>
			</div>

			<!-- Confirm Password -->
			<div>
				<label for="confirmPassword" class="mb-1.5 block text-xs font-medium text-zinc-400">Confirm Password</label>
				<div class="relative">
					<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><Lock size={15} /></span>
					<input id="confirmPassword" type="password" bind:value={confirmPassword} placeholder="••••••••" class="input input-with-icon" required autocomplete="new-password" />
				</div>
			</div>

			<button type="submit" class="btn-primary mt-2 w-full" disabled={loading}>
				{#if loading}
					<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900"></span>
					Creating account…
				{:else}
					Create account
					<ArrowRight size={15} />
				{/if}
			</button>
		</form>

		<div class="mt-5 border-t border-white/5 pt-4 text-center">
			<a href="/" class="inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300">
				<ChevronLeft size={13} />
				Back to sign in
			</a>
		</div>
	</div>
</div>
