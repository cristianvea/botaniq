// Página de instalación: pestaña según el móvil, código de invitación y botón de instalar en Android
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var ua = navigator.userAgent;
  var android = /android/i.test(ua);

  function show(which) {
    ['ios', 'android'].forEach(function (k) {
      $(k).hidden = k !== which;
      $('tab-' + k).setAttribute('aria-selected', String(k === which));
    });
  }
  $('tab-ios').onclick = function () { show('ios'); };
  $('tab-android').onclick = function () { show('android'); };
  show(android ? 'android' : 'ios');

  // Código de invitación (?casa=XXXX)
  var code = (new URLSearchParams(location.search).get('casa') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (code) {
    $('invite').hidden = false;
    $('code').textContent = code;
    $('open').href = '../?casa=' + encodeURIComponent(code);
    $('step-house').innerHTML = 'Elige <b>«Unirme con código»</b> y escribe <b>' + code + '</b>.';
    $('copy').onclick = function () {
      navigator.clipboard && navigator.clipboard.writeText(code).then(function () { $('copy').textContent = 'Copiado ✓'; });
    };
  }

  // Ya instalada (abierta como app)
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) $('installed').hidden = false;

  // Android/Chrome: instalación con un toque
  var prompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    prompt = e;
    $('android-auto').hidden = false;
    $('android-menu').innerHTML = 'Si el botón no funciona: menú <b>⋮</b> (arriba a la derecha) → <b>«Instalar aplicación»</b>.';
  });
  $('install').onclick = function () {
    if (!prompt) return;
    prompt.prompt();
    prompt.userChoice.then(function () { prompt = null; $('android-auto').hidden = true; });
  };
  window.addEventListener('appinstalled', function () { $('installed').hidden = false; });
})();
