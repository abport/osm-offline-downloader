/*
 * gis-toolkit.js - OSM style editor for the offline map downloader.
 * Provides a layers panel with per-class styling for every OSM cartography
 * class, driven through the OsmCartoStyle controller returned by render().
 *
 * State is exposed via GisToolkit.getState() so app.js can bundle style
 * overrides and the active theme into the offline viewer and GIS export.
 */
'use strict';

var GisToolkit = (function () {
  var map = null;
  var cartoController = null;
  var overrides = OsmCartoStyle.defaultOverrides();
  var theme = OsmCartoStyle.DEFAULT_THEME;
  var els = {};

  function t(k) { return I18n.t(k); }

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c != null) e.appendChild(c); });
    return e;
  }

  function applyOverrides() {
    if (!cartoController) return;
    cartoController.setOverrides(overrides);
  }

  function resetClassOverrides(cls) {
    overrides[cls] = Object.assign({}, OsmCartoStyle.defaultStyleFor(cls));
    applyOverrides();
  }

  function colorRow(labelKey, value, onInput) {
    var input = el('input', { type: 'color', value: value || '#000000' });
    input.addEventListener('input', function () { onInput(input.value); });
    input.addEventListener('change', function () { onInput(input.value); });
    return el('div', { class: 'gis-row' }, [el('label', { 'data-i18n': labelKey, text: t(labelKey) }), input]);
  }

  function numberRow(labelKey, value, step, min, max, onInput) {
    var input = el('input', { type: 'number', value: value != null ? value : '', step: step, min: min, max: max, class: 'gis-num' });
    input.addEventListener('input', function () { onInput(input.value); });
    input.addEventListener('change', function () { onInput(input.value); });
    return el('div', { class: 'gis-row' }, [el('label', { 'data-i18n': labelKey, text: t(labelKey) }), input]);
  }

  function textRow(labelKey, value, onInput) {
    var input = el('input', { type: 'text', value: value || '' });
    input.addEventListener('input', function () { onInput(input.value); });
    return el('div', { class: 'gis-row' }, [el('label', { 'data-i18n': labelKey, text: t(labelKey) }), input]);
  }

  function checkboxRow(labelKey, checked, onChange) {
    var input = el('input', { type: 'checkbox' });
    input.checked = !!checked;
    input.addEventListener('change', function () { onChange(input.checked); });
    return el('div', { class: 'gis-row' }, [el('label', { 'data-i18n': labelKey, text: t(labelKey) }), input]);
  }

  function setLabelVisibility(ov, visible) {
    ov.labelHidden = !visible;
    ov.hidden = !visible;
  }

  function osmClassEditor(cls, refreshEditor) {
    var ov = overrides[cls];
    var rows = [];
    var hasFill = ('fillColor' in ov);
    var hasStroke = ('color' in ov) || ('weight' in ov);
    var isLabel = ('labelColor' in ov);
    var labelOnly = OsmCartoStyle.isLabelOnlyClass(cls);

    if (!labelOnly) {
      rows.push(checkboxRow('visible', !ov.hidden, function (v) { ov.hidden = !v; applyOverrides(); }));
    }
    if (hasFill) {
      rows.push(colorRow('fill_color', ov.fillColor, function (v) { ov.fillColor = v; applyOverrides(); }));
      rows.push(numberRow('opacity', ov.fillOpacity != null ? ov.fillOpacity : 1, 0.05, 0, 1, function (v) { ov.fillOpacity = Number(v); applyOverrides(); }));
    }
    if (hasStroke) {
      if ('color' in ov) rows.push(colorRow('stroke_color', ov.color, function (v) { ov.color = v; applyOverrides(); }));
      if ('weight' in ov) rows.push(numberRow('stroke_width', ov.weight, 0.5, 0, 30, function (v) { ov.weight = Number(v); applyOverrides(); }));
      rows.push(textRow('dash', ov.dashArray, function (v) { ov.dashArray = v; applyOverrides(); }));
    }
    if (isLabel) {
      rows.push(colorRow('label_color', ov.labelColor, function (v) { ov.labelColor = v; applyOverrides(); }));
      rows.push(numberRow('label_size', ov.labelSize, 1, 6, 40, function (v) {
        ov.labelSize = (v === '' || v == null) ? null : Number(v);
        applyOverrides();
      }));
      rows.push(checkboxRow('labels', !OsmCartoStyle.isLabelHidden(ov), function (v) {
        setLabelVisibility(ov, v);
        applyOverrides();
      }));
    }
    rows.push(el('button', {
      type: 'button',
      class: 'gis-reset-btn',
      'data-i18n': 'reset_layer',
      text: t('reset_layer'),
      onclick: function () {
        resetClassOverrides(cls);
        if (refreshEditor) refreshEditor();
        renderLayersPanel();
      }
    }));
    return el('div', { class: 'gis-editor-body' }, rows);
  }

  function classRow(cls) {
    var ov = overrides[cls];
    var labelOnly = OsmCartoStyle.isLabelOnlyClass(cls);
    var swatch = el('span', { class: 'gis-swatch' });
    swatch.style.background = ov.fillColor || ov.color || ov.labelColor || 'linear-gradient(135deg,#ccc 45%,#eee 55%)';
    var vis = el('input', { type: 'checkbox' });
    if (labelOnly) {
      vis.checked = !OsmCartoStyle.isLabelHidden(ov);
      vis.addEventListener('change', function () {
        setLabelVisibility(ov, vis.checked);
        applyOverrides();
      });
    } else {
      vis.checked = !ov.hidden;
      vis.addEventListener('change', function () { ov.hidden = !vis.checked; applyOverrides(); });
    }
    var name = el('span', { class: 'gis-layer-name', 'data-i18n': 'class_' + cls, text: t('class_' + cls) });
    var gear = el('button', { class: 'gis-icon-btn', title: t('style_editor'), text: '\u2699' });
    var body = el('div', { class: 'gis-editor-collapsed' });
    var open = false;
    function showEditor() {
      body.innerHTML = '';
      body.appendChild(osmClassEditor(cls, showEditor));
      body.className = 'gis-editor-open';
    }
    gear.addEventListener('click', function () {
      open = !open;
      if (open) showEditor();
      else body.className = 'gis-editor-collapsed';
    });
    return el('div', { class: 'gis-layer' }, [
      el('div', { class: 'gis-layer-head' }, [vis, swatch, name, gear]),
      body
    ]);
  }

  function renderLayersPanel() {
    if (!els.layersBody) return;
    els.layersBody.innerHTML = '';
    els.layersBody.appendChild(el('div', { class: 'gis-section-title', 'data-i18n': 'osm_layers', text: t('osm_layers') }));
    OsmCartoStyle.STYLE_CLASSES.forEach(function (cls) { els.layersBody.appendChild(classRow(cls)); });
    I18n.apply(els.layersBody);
  }

  function buildUi() {
    var sidebar = document.getElementById('sidebar');

    var langSel = el('select', { id: 'gisLang' }, [
      el('option', { value: 'en', text: t('english') }),
      el('option', { value: 'fa', text: t('persian') })
    ]);
    langSel.value = I18n.current();
    langSel.addEventListener('change', function () { I18n.set(langSel.value); });
    var langRow = el('div', { class: 'gis-row' }, [el('label', { 'data-i18n': 'language', text: t('language') }), langSel]);

    var themeSel = el('select', { id: 'gisTheme' });
    OsmCartoStyle.themeIds().forEach(function (id) {
      themeSel.appendChild(el('option', { value: id, text: OsmCartoStyle.themeLabel(id) }));
    });
    themeSel.value = theme;
    themeSel.addEventListener('change', function () {
      theme = themeSel.value;
      if (cartoController && cartoController.setTheme) cartoController.setTheme(theme);
    });
    var themeRow = el('div', { class: 'gis-row' }, [el('label', { 'data-i18n': 'map_style', text: t('map_style') }), themeSel]);

    var layersBody = el('div', { id: 'gisLayersBody', class: 'gis-layers-body' });

    var panel = el('div', { id: 'gisPanel', class: 'gis-panel' }, [
      el('h2', { 'data-i18n': 'layers', text: t('layers') }),
      langRow,
      themeRow,
      layersBody
    ]);

    sidebar.appendChild(panel);
    els.layersBody = layersBody;

    I18n.applyDir();
    renderLayersPanel();
  }

  function init(opts) {
    map = opts.map;
    cartoController = opts.cartoController || null;
    if (opts.overrides) overrides = opts.overrides;
    buildUi();
    I18n.onChange(function () {
      renderLayersPanel();
      var ls = document.getElementById('gisLang');
      if (ls) ls.value = I18n.current();
    });
  }

  function setCartoController(c) {
    cartoController = c;
    if (cartoController && cartoController.setTheme) cartoController.setTheme(theme);
    applyOverrides();
  }

  /** Read the map-style selector into state and push overrides to the renderer. */
  function syncUiToState() {
    var themeSel = document.getElementById('gisTheme');
    if (themeSel && themeSel.value) theme = themeSel.value;
    applyOverrides();
  }

  function getState() {
    return {
      overrides: overrides,
      theme: theme,
      customLayers: []
    };
  }

  /** Snapshot of theme + overrides for bundling into the offline zip. */
  function getExportState() {
    syncUiToState();
    var exportTheme = theme;
    var src = overrides;
    if (cartoController) {
      if (cartoController.getTheme) exportTheme = cartoController.getTheme();
      if (cartoController.getOverrides) src = cartoController.getOverrides();
    }
    return {
      overrides: JSON.parse(JSON.stringify(src)),
      theme: exportTheme,
      customLayers: []
    };
  }

  return {
    init: init,
    setCartoController: setCartoController,
    syncUiToState: syncUiToState,
    getState: getState,
    getExportState: getExportState
  };
})();
