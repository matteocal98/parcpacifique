<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Connexion - ParcPacific</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: { sans: ['Inter', 'sans-serif'] },
                    colors: {
                        pacific: { 900: '#0F4C75', 800: '#1B5D8B', 600: '#3282B8', 100: '#E0F2FE' }
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-slate-50 text-slate-800 antialiased min-h-screen flex flex-col">

    <!-- Header simplifié -->
    <header class="w-full bg-white border-b border-slate-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <a href="index.html" class="flex items-center gap-2 group">
                <div class="bg-pacific-900 text-white p-1.5 rounded-lg group-hover:bg-pacific-800 transition-colors">
                    <i data-lucide="waves" class="w-5 h-5"></i>
                </div>
                <span class="text-lg font-bold text-pacific-900">ParcPacific</span>
            </a>
            <a href="index.html" class="text-sm text-slate-500 hover:text-pacific-900 flex items-center gap-1">
                <i data-lucide="arrow-left" class="w-4 h-4"></i> Retour à l'accueil
            </a>
        </div>
    </header>

    <!-- Contenu principal centré -->
    <main class="flex-grow flex items-center justify-center p-4">
        <div class="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
            
            <div class="text-center mb-8">
                <h1 class="text-2xl font-bold text-slate-900">Bon retour parmi nous</h1>
                <p class="text-slate-500 mt-2">Connectez-vous pour accéder au carnet d'entretien de vos machines.</p>
            </div>

            <form action="#" method="POST" class="space-y-5">
                <!-- Email -->
                <div>
                    <label for="email" class="block text-sm font-medium text-slate-700 mb-1">Adresse e-mail</label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <i data-lucide="mail" class="w-5 h-5"></i>
                        </div>
                        <input type="email" id="email" name="email" required 
                            class="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pacific-600 focus:border-pacific-600 outline-none transition-all"
                            placeholder="vous@exemple.com">
                    </div>
                </div>

                <!-- Mot de passe -->
                <div>
                    <label for="password" class="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <i data-lucide="lock" class="w-5 h-5"></i>
                        </div>
                        <input type="password" id="password" name="password" required 
                            class="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pacific-600 focus:border-pacific-600 outline-none transition-all"
                            placeholder="••••••••">
                        <button type="button" onclick="togglePassword()" class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer">
                            <i data-lucide="eye" id="eye-icon" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>

                <!-- Forgot password -->
                <div class="flex items-center justify-end">
                    <a href="#" class="text-sm font-medium text-pacific-600 hover:text-pacific-800 hover:underline">
                        Mot de passe oublié ?
                    </a>
                </div>

                <!-- Submit Button -->
                <button type="submit" class="w-full bg-pacific-900 hover:bg-pacific-800 text-white font-semibold py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                    Se connecter
                    <i data-lucide="arrow-right" class="w-4 h-4"></i>
                </button>
            </form>

            <div class="mt-6 text-center text-sm text-slate-600">
                Pas encore de compte ? 
                <a href="#" class="font-semibold text-pacific-600 hover:text-pacific-800 hover:underline">Créer un compte gratuitement</a>
            </div>
        </div>
    </main>

    <!-- Footer simplifié -->
    <footer class="py-6 text-center text-sm text-slate-400 border-t border-slate-200 bg-white">
        <div class="flex justify-center gap-4 mb-2">
            <a href="#" class="hover:text-slate-600">Mentions légales</a>
            <span>·</span>
            <a href="#" class="hover:text-slate-600">Confidentialité</a>
        </div>
        <p>&copy; 2026 ParcPacific. Tous droits réservés.</p>
    </footer>

    <script>
        lucide.createIcons();
        function togglePassword() {
            const passwordInput = document.getElementById('password');
            const eyeIcon = document.getElementById('eye-icon');
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                eyeIcon.setAttribute('data-lucide', 'eye-off');
            } else {
                passwordInput.type = 'password';
                eyeIcon.setAttribute('data-lucide', 'eye');
            }
            lucide.createIcons();
        }
    </script>
</body>
</html>
