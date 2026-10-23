(function (root) {
  'use strict';
  const pricing = {};

  function selectedTemplate(state, catalog) {
    const requested = state && (state.templateId || state.template);
    return catalog.templates.find(template => template.id === requested) || catalog.templates[0];
  }

  function discountIsActive(catalog) {
    const discount = catalog.discount;
    if (!discount || !discount.active) return false;
    if (!discount.endsAt) return true;
    const end = Date.parse(discount.endsAt);
    return Number.isFinite(end) && end > Date.now();
  }

  pricing.validateState = function (state, catalog) {
    const input = state || {};
    const template = selectedTemplate(input, catalog);
    return Object.assign({}, input, {templateId: template.id, express: Boolean(input.express || input.delivery === 'express')});
  };

  pricing.calculateQuote = function (state, catalog) {
    const clean = pricing.validateState(state, catalog);
    const template = selectedTemplate(clean, catalog);
    const listTotalUSD = catalog.listPrice;
    const discountUSD = discountIsActive(catalog)
      ? Math.round(listTotalUSD * catalog.discount.percent) / 100
      : 0;
    const express = clean.express;
    const lines = [
      {id: template.id, label: `Template Invitation: ${template.label}`, amountUSD: listTotalUSD, type: 'template'}
    ];
    if (discountUSD) {
      lines.push({id: 'discount', label: catalog.discount.label, amountUSD: -discountUSD, type: 'discount'});
    }
    if (express) {
      lines.push({id: 'express', label: 'Express delivery', amountUSD: catalog.expressPrice, type: 'express'});
    }
    const totalUSD = listTotalUSD - discountUSD + (express ? catalog.expressPrice : 0);
    return {lines, listTotalUSD, discountUSD, totalUSD, subtotalUSD: totalUSD, template, express};
  };

  pricing.formatMoney = function (amountUSD, currencyId, catalog) {
    const cat = catalog || (root.DI && root.DI.catalog) || {};
    const currencies = cat.currencies || {};
    const currency = currencies[currencyId] || currencies.USD || { symbol: '$', rate: 1 };
    const amount = Math.round(amountUSD * currency.rate * 100) / 100;
    const whole = Number.isInteger(amount);
    return `${currency.symbol}${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2
    }).format(amount)}`;
  };

  root.DI.pricing = pricing;
}(window));
