<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import { api } from '$lib/api';
	import { APP_NAME, HACKATHON, ORGANIZER, AUTHOR, AUTHOR_ID } from '$lib/config';
	import toast from 'svelte-5-french-toast';
	import Lock from '@lucide/svelte/icons/lock';
	import Hash from '@lucide/svelte/icons/hash';
	import Building2 from '@lucide/svelte/icons/building-2';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import UserRound from '@lucide/svelte/icons/user-round';
	import LogOut from '@lucide/svelte/icons/log-out';

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmNewPassword = $state('');
	let pwLoading = $state(false);

	onMount(() => {
		if (!auth.isLoggedIn) goto('/');
	});

	async function handleChangePassword(e: SubmitEvent) {
		e.preventDefault();
		if (newPassword !== confirmNewPassword) { toast.error('New passwords do not match.'); return; }
		if (newPassword.length < 6) { toast.error('New password must be at least 6 characters.'); return; }
		pwLoading = true;
		try {
			await api.changePassword(auth.token!, currentPassword, newPassword);
			toast.success('Password updated successfully!');
			currentPassword = '';
			newPassword = '';
			confirmNewPassword = '';
		} catch (err: any) {
			toast.error(err.error || 'Failed to update password.');
		} finally {
			pwLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Profile - {APP_NAME}</title>
</svelte:head>

<div class="mx-auto max-w-xl px-4 py-8 sm:px-6">
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-zinc-100">Profile</h1>
		<p class="mt-0.5 text-sm text-zinc-500">Your account details</p>
	</div>

	<!-- Profile card -->
	<div class="glass mb-4 p-6">
		<div class="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
			<!-- Avatar with amber ring -->
			<div class="ring-2 ring-amber-500/30 ring-offset-2 ring-offset-zinc-900 rounded-2xl shrink-0">
				<img
					src="https://api.dicebear.com/9.x/thumbs/svg?seed={auth.student?.avatar_seed}&backgroundColor=27272a"
					alt="avatar"
					class="h-20 w-20 rounded-2xl"
				/>
			</div>
			<div class="flex-1 text-center sm:text-left">
				<p class="text-xl font-bold text-zinc-100">{auth.student?.full_name}</p>

				<!-- Info rows -->
				<div class="mt-3 space-y-1.5">
					<div class="flex items-center justify-center gap-2 sm:justify-start">
						<Hash size={13} class="text-zinc-600" />
						<span class="text-sm text-zinc-400">{auth.student?.student_id}</span>
					</div>
					<div class="flex items-center justify-center gap-2 sm:justify-start">
						<Building2 size={13} class="text-zinc-600" />
						<span class="text-sm text-zinc-400">{auth.student?.department}</span>
					</div>
					<div class="flex items-center justify-center gap-2 sm:justify-start">
						<GraduationCap size={13} class="text-zinc-600" />
						<span class="text-sm text-zinc-400">Batch '{auth.student?.batch}</span>
					</div>
				</div>

				<!-- Role badge -->
				<div class="mt-3 flex justify-center sm:justify-start">
					{#if auth.student?.role === 'admin'}
						<span class="badge-amber inline-flex items-center gap-1.5">
							<ShieldCheck size={11} />Admin
						</span>
					{:else}
						<span class="badge-zinc inline-flex items-center gap-1.5">
							<UserRound size={11} />Student
						</span>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Change password -->
	<div class="glass mb-4 p-6">
		<h2 class="mb-5 text-base font-semibold text-zinc-100">Change Password</h2>
		<form onsubmit={handleChangePassword} class="space-y-4">
			<div>
				<label for="currentPw" class="mb-1.5 block text-xs font-medium text-zinc-400">Current Password</label>
				<div class="relative">
					<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><Lock size={14} /></span>
					<input id="currentPw" type="password" bind:value={currentPassword} placeholder="••••••••" class="input input-with-icon" required autocomplete="current-password" />
				</div>
			</div>
			<div>
				<label for="newPw" class="mb-1.5 block text-xs font-medium text-zinc-400">New Password</label>
				<div class="relative">
					<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><Lock size={14} /></span>
					<input id="newPw" type="password" bind:value={newPassword} placeholder="Min. 6 characters" class="input input-with-icon" required autocomplete="new-password" />
				</div>
			</div>
			<div>
				<label for="confirmNewPw" class="mb-1.5 block text-xs font-medium text-zinc-400">Confirm New Password</label>
				<div class="relative">
					<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><Lock size={14} /></span>
					<input id="confirmNewPw" type="password" bind:value={confirmNewPassword} placeholder="••••••••" class="input input-with-icon" required autocomplete="new-password" />
				</div>
			</div>
			<button type="submit" class="btn-primary" disabled={pwLoading}>
				{#if pwLoading}
					<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900"></span>
					Updating…
				{:else}
					Update Password
				{/if}
			</button>
		</form>
	</div>

	<!-- Sign out -->
	<div class="glass border-red-500/10 p-6">
		<h2 class="mb-1 text-sm font-semibold text-zinc-400">Sign Out</h2>
		<p class="mb-4 text-xs text-zinc-600">This will clear your session from this device.</p>
		<button
			onclick={() => { auth.logout(); goto('/'); }}
			class="btn-danger inline-flex items-center gap-2"
		>
			<LogOut size={14} />
			Sign out
		</button>
	</div>

	<!-- Footer attribution (inside profile for logged-in users) -->
	<p class="mt-8 text-center text-xs text-zinc-700">
		Built for {HACKATHON} · {ORGANIZER}<br />
		Submitted by {AUTHOR} · {AUTHOR_ID}
	</p>
</div>
