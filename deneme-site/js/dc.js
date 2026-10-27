// Forest Club Urla · tasarım sayfalarını (.dc.html) tarayıcıda çalıştıran küçük motor.
// Sayfalar tasarımdaki haliyle kullanılır: {{ alan }}, <sc-if>, <sc-for>, onClick/onChange, class Component
// extends DCLogic (state, setState, renderVals, componentDidMount). Her durum değişikliğinde sayfa yeniden üretilir
// ve canlı sayfaya yalnız farklar işlenir (yazılan kutu odağını kaybetmez).
(function () {
  'use strict';

  const BOS_DEGER = ['disabled', 'checked', 'selected', 'hidden', 'readonly', 'required', 'muted', 'loop',
    'autoplay', 'open', 'multiple', 'playsinline', 'controls'];
  const OZELLIK = ['value', 'checked', 'selected', 'muted', 'indeterminate'];
  const SAYFA = { 'Site.dc.html': '/', 'Uye.dc.html': '/uye', 'Main.dc.html': '/yonetim', 'Ode.dc.html': '/ode' };

  function bak(kapsam, yol) {
    yol = yol.trim();
    if (yol === 'true') return true;
    if (yol === 'false') return false;
    if (yol === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(yol)) return Number(yol);
    if (/^'.*'$|^".*"$/.test(yol)) return yol.slice(1, -1);
    let v = kapsam;
    for (const k of yol.split('.')) {
      if (v == null) return undefined;
      v = v[k];
    }
    return v;
  }

  function tekAlan(metin) {
    const m = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/.exec(metin);
    return m ? m[1] : null;
  }

  function yerlestir(metin, kapsam) {
    return metin.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, yol) => {
      const v = bak(kapsam, yol);
      return v == null ? '' : String(v);
    });
  }

  function hrefCevir(h) {
    const m = /(?:^|\/)([A-Za-z0-9_-]+\.dc\.html)(#.*)?$/.exec(h || '');
    if (!m || /^[a-z]+:\/\//i.test(h)) return h;
    return (SAYFA[m[1]] || '/') + (m[2] || '');
  }

  // Bağlantı ve kaynak adresleri: yalnız https:, mailto:, tel:, site içi (/…) ve sayfa içi (#…). Veritabanından gelen
  // "javascript:" gibi değerler çalışmasın; başka siteye götüren "//alan.com" da site içi sayılmaz. Kalanı "#" olur.
  const ADRES_OZELLIK = ['href', 'src', 'action', 'formaction'];
  function guvenliAdres(a) {
    const s = String(a).trim();
    return /^(https:|mailto:|tel:|#|\/(?![\/\\]))/i.test(s) ? s : '#';
  }

  function olayAdi(el, ad) {
    const tur = ad.slice(2).toLowerCase();
    if (tur !== 'change') return tur;
    const etiket = el.tagName;
    const tip = (el.getAttribute('type') || '').toLowerCase();
    if (etiket === 'SELECT' || tip === 'checkbox' || tip === 'radio' || tip === 'file') return 'change';
    return 'input'; // React gibi: metin kutusunda her tuşta
  }

  // Şablon düğümünden canlı düğüm üretir (her çizimde baştan)
  function uret(dugum, kapsam, ebeveyn) {
    if (dugum.nodeType === 3) {
      ebeveyn.appendChild(document.createTextNode(yerlestir(dugum.nodeValue, kapsam)));
      return;
    }
    if (dugum.nodeType !== 1) return;
    if (dugum.tagName === 'TEMPLATE' && dugum.hasAttribute('data-sc-if')) {
      const yol = tekAlan(dugum.getAttribute('data-sc-if') || '');
      if (yol !== null && bak(kapsam, yol)) dugum.content.childNodes.forEach((c) => uret(c, kapsam, ebeveyn));
      return;
    }
    if (dugum.tagName === 'TEMPLATE' && dugum.hasAttribute('data-sc-for')) {
      const yol = tekAlan(dugum.getAttribute('data-sc-for') || '');
      const liste = yol !== null ? bak(kapsam, yol) : null;
      const ad = dugum.getAttribute('as') || 'item';
      (Array.isArray(liste) ? liste : []).forEach((oge, i) => {
        const k = Object.create(kapsam);
        k[ad] = oge;
        k.$index = i;
        dugum.content.childNodes.forEach((c) => uret(c, k, ebeveyn));
      });
      return;
    }
    const el = document.createElementNS(dugum.namespaceURI || 'http://www.w3.org/1999/xhtml', dugum.tagName.toLowerCase());
    el.__olay = {};
    el.__ozellik = {};
    for (const a of Array.from(dugum.attributes)) {
      const ad = a.name;
      if (ad.startsWith('hint-')) continue;
      const yol = tekAlan(a.value);
      if (/^on[a-z]+$/i.test(ad) && ad.length > 2) {
        const f = yol !== null ? bak(kapsam, yol) : null;
        if (typeof f === 'function') el.__olay[olayAdi(dugum, ad)] = f;
        continue;
      }
      let deger = yol !== null ? bak(kapsam, yol) : (a.value.includes('{{') ? yerlestir(a.value, kapsam) : a.value);
      const kucuk = ad.toLowerCase();
      if (kucuk === 'href' && typeof deger === 'string') deger = hrefCevir(deger);
      if (ADRES_OZELLIK.includes(kucuk) && deger != null && deger !== false) deger = guvenliAdres(deger);
      if (OZELLIK.includes(kucuk)) el.__ozellik[kucuk] = kucuk === 'value' ? (deger == null ? '' : deger) : !!(deger === '' || deger);
      if (BOS_DEGER.includes(kucuk)) {
        if (deger === false || deger == null || deger === 'false') continue;
        el.setAttribute(ad, '');
        continue;
      }
      if (deger == null || deger === false) continue;
      if (kucuk === 'value' && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) continue;
      el.setAttribute(ad, String(deger));
    }
    const kaynak = dugum.tagName === 'TEMPLATE' ? dugum.content : dugum;
    kaynak.childNodes.forEach((c) => uret(c, kapsam, el));
    ebeveyn.appendChild(el);
  }

  function olaylariBagla(canli, yeni) {
    canli.__olay = yeni.__olay || {};
    canli.__bagli = canli.__bagli || {};
    Object.keys(canli.__olay).forEach((tur) => {
      if (canli.__bagli[tur]) return;
      canli.__bagli[tur] = true;
      canli.addEventListener(tur, (e) => {
        const f = canli.__olay && canli.__olay[tur];
        if (f) f(e);
      });
    });
  }

  function ozellikleriUygula(canli, yeni) {
    const oz = yeni.__ozellik || {};
    if ('value' in oz) {
      const v = String(oz.value);
      if (canli.tagName === 'SELECT') {
        if (canli.value !== v) canli.value = v;
      } else if (canli.value !== v) {
        canli.value = v;
      }
    }
    ['checked', 'selected', 'muted'].forEach((k) => {
      if (k in oz && canli[k] !== oz[k]) canli[k] = oz[k];
    });
  }

  // Yeni üretilen ağacı canlı ağaca işler
  function isle(canli, yeni) {
    if (canli.nodeType !== yeni.nodeType || canli.nodeName !== yeni.nodeName) {
      if (yeni.nodeType === 1) baglaHepsi(yeni);
      canli.replaceWith(yeni);
      return;
    }
    if (canli.nodeType === 3) {
      if (canli.nodeValue !== yeni.nodeValue) canli.nodeValue = yeni.nodeValue;
      return;
    }
    if (canli.nodeType !== 1) return;
    for (const a of Array.from(canli.attributes)) if (!yeni.hasAttribute(a.name)) canli.removeAttribute(a.name);
    for (const a of Array.from(yeni.attributes)) if (canli.getAttribute(a.name) !== a.value) canli.setAttribute(a.name, a.value);
    olaylariBagla(canli, yeni);
    cocuklariIsle(canli, yeni);
    ozellikleriUygula(canli, yeni);
  }

  function cocuklariIsle(canli, yeni) {
    const cc = Array.from(canli.childNodes);
    const yc = Array.from(yeni.childNodes);
    for (let i = 0; i < yc.length; i++) {
      if (i < cc.length) isle(cc[i], yc[i]);
      else {
        if (yc[i].nodeType === 1) baglaHepsi(yc[i]);
        canli.appendChild(yc[i]);
      }
    }
    for (let i = yc.length; i < cc.length; i++) cc[i].remove();
  }

  function baglaHepsi(el) {
    olaylariBagla(el, el);
    ozellikleriUygula(el, el);
    Array.from(el.children).forEach(baglaHepsi);
  }

  class DCLogic {
    constructor(props) {
      this.props = props || {};
      this.state = {};
    }
    setState(deg, sonra) {
      this.__bekleyen = this.__bekleyen || [];
      this.__bekleyen.push(deg);
      if (sonra) (this.__sonra = this.__sonra || []).push(sonra);
      if (!this.__planli) {
        this.__planli = true;
        Promise.resolve().then(() => this.__uygula());
      }
    }
    forceUpdate() { this.setState({}); }
    __uygula() {
      this.__planli = false;
      const once = this.state;
      let s = this.state;
      (this.__bekleyen || []).forEach((d) => { s = { ...s, ...(typeof d === 'function' ? d(s, this.props) : d) }; });
      this.__bekleyen = [];
      this.state = s;
      this.__ciz();
      if (this.componentDidUpdate) this.componentDidUpdate(this.props, once);
      if (window.DC.durumDegisti) window.DC.durumDegisti(this, once, s);
      const sonra = this.__sonra || [];
      this.__sonra = [];
      sonra.forEach((f) => f());
    }
    __ciz() {
      const kapsam = this.renderVals ? this.renderVals() : {};
      const parca = document.createElement('div');
      this.__sablon.childNodes.forEach((c) => uret(c, kapsam, parca));
      if (!this.__kok.__ilk) {
        this.__kok.__ilk = true;
        while (parca.firstChild) {
          const c = parca.firstChild;
          if (c.nodeType === 1) baglaHepsi(c);
          this.__kok.appendChild(c);
        }
        return;
      }
      cocuklariIsle(this.__kok, parca);
    }
  }

  // Sayfa kaynağını okuyup kök öğeye yerleştirir. `degistir(kaynak)` betik metnini değiştirmek için (isteğe bağlı).
  async function bagla(adres, kok, secenek = {}) {
    let html = await (await fetch(adres, { cache: 'no-cache' })).text();
    const ext = secenek.varliklar || {};
    html = html.replace(/\/_blob\/([0-9a-f]{32})/g, (m, id) => `/_blob/${id}${ext[id] || ''}`);
    const govde = html.split(/<x-dc>/)[1].split(/<\/x-dc>/)[0]
      .replace(/<sc-if\b/g, '<template data-sc-if-kaynak').replace(/<\/sc-if>/g, '</template>')
      .replace(/<sc-for\b/g, '<template data-sc-for-kaynak').replace(/<\/sc-for>/g, '</template>');
    const betikEtiket = /<script type="text\/x-dc"[^>]*data-dc-script[^>]*>/.exec(html);
    let betik = html.slice(betikEtiket.index + betikEtiket[0].length).split('</script>')[0];
    if (secenek.degistir) betik = secenek.degistir(betik);
    const sablon = document.createElement('template');
    sablon.innerHTML = govde;
    // <template data-sc-if-kaynak value=".."> → data-sc-if=".."
    const duzelt = (kok2) => {
      kok2.querySelectorAll('template').forEach((t) => {
        if (t.hasAttribute('data-sc-if-kaynak')) t.setAttribute('data-sc-if', t.getAttribute('value') || '');
        if (t.hasAttribute('data-sc-for-kaynak')) t.setAttribute('data-sc-for', t.getAttribute('list') || '');
        duzelt(t.content);
      });
    };
    duzelt(sablon.content);
    const helmet = sablon.content.querySelector('helmet');
    if (helmet) {
      Array.from(helmet.childNodes).forEach((c) => { if (c.nodeType === 1) document.head.appendChild(c.cloneNode(true)); });
      helmet.remove();
    }
    const Component = new Function('DCLogic', `${betik}\nreturn Component;`)(DCLogic);
    const bilesen = new Component(secenek.props || {});
    bilesen.__sablon = sablon.content;
    bilesen.__kok = kok;
    kok.removeAttribute('style');  // "Yükleniyor…" kutusunun boşluğu sayfada kalmasın
    kok.textContent = '';
    bilesen.__ciz();
    if (bilesen.componentDidMount) bilesen.componentDidMount();
    return bilesen;
  }

  window.DC = { bagla, DCLogic, durumDegisti: null };
})();
