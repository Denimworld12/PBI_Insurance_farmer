// Pricing.jsx
import React, { useState } from 'react';
import './Pricing.css';
// import govLogo from '/images/government-emblem.png'; // Place your emblem image in src and import

const Pricing = () => {
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [claims, setClaims] = useState(5000);

  const calculateSavings = () => {
    const traditional = claims * 800; // ₹800 per claim traditional cost
    const pbi = claims * 5; // ₹400 per claim AI system cost
    const savings = traditional - pbi;
    return { traditional, pbi, savings };
  };

  const { traditional, pbi, savings } = calculateSavings();

  const CheckIcon = () => (
    <svg className="check-icon" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19.29 14.12">
      <path d="M5.68 14.12 0 8.44l1.41-1.41 4.32 4.31L17.93 0l1.36 1.46L5.68 14.12z"></path>
    </svg>
  );

  const plans = [
    {
      name: 'Starter',
      subtitle: 'For Regional Banks & Co-ops',
      price: billingCycle === 'monthly' ? '₹49,999' : '₹4,99,990',
      period: billingCycle === 'monthly' ? '/month' : '/year',
      description: 'Essential AI verification suite for small-scale operations.',
      emblem: true,
      features: [
        'AI Image Verification',
        'GPS Geofencing',
        'EXIF Analysis',
        'Weather API Integration',
      ],
    },
    {
      name: 'Professional',
      subtitle: 'For Large State Banks',
      price: billingCycle === 'monthly' ? '₹1,49,999' : '₹14,99,990',
      period: billingCycle === 'monthly' ? '/month' : '/year',
      description: 'Advanced AI modeling and analytics for enterprise needs.',
      emblem: true,
      features: [
        'AI Image Verification',
        'GPS Geofencing',
        'EXIF Analysis',
        'Advanced Analytics',
        'Priority 24/7 Support',
      ],
      popular: true,
    },
    {
      name: 'Enterprise',
      subtitle: 'For Government & National Programs',
      price: 'Custom',
      period: '',
      description: 'Full customization and on-premise AI deployment.',
      emblem: true,
      features: [
        'Dedicated Infrastructure',
        'Custom ML Models',
        'On-Premise Deployment',
        'Dedicated Success Team',
      ],
    },
  ];

  return (
    <div className="pricing-page fade-in">
      {/* Hero Section */}
      <section className="pricing-hero">
        <div className="pricing-hero-content">
          <h1 className="pricing-hero-title">Transform Agricultural Insurance with AI</h1>
          <p className="pricing-hero-subtitle">
            Reduce claim time by 90% and fraud by 70% with PBI AgriInsure.
          </p>

          {/* Billing Toggle */}
          <div className="billing-toggle">
            <span className={billingCycle === 'monthly' ? 'active' : ''}>Monthly</span>
            <button
              className="toggle-switch"
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            >
              <span className="toggle-slider"></span>
            </button>
            <span className={billingCycle === 'yearly' ? 'active' : ''}>
              Yearly <span className="save-badge">Save 17%</span>
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Plans */}
      <section className="pricing-plans">
        <div className="plans-container">
          <h2 className="section-title">Choose Your Plan</h2>
          <p className="section-subtitle">Tailored for banks and government programs</p>

          <div className="plans-grid">
            {plans.map((plan, i) => (
              <div key={i} className={`plan-card ${plan.popular ? 'popular' : ''}`}>
                {plan.popular && <div className="popular-badge">Most Popular</div>}
                <div className="plan-header">
                  {plan.emblem && (
                    <img src={"/images/government-emblem.png"} alt="Gov Emblem" className="gov-emblem" />
                  )}
                  <h3 className="plan-name">{plan.name}</h3>
                  <p className="plan-subtitle">{plan.subtitle}</p>
                  <div className="plan-price">
                    <span className="price">{plan.price}</span>
                    <span className="period">{plan.period}</span>
                  </div>
                  <p className="plan-description">{plan.description}</p>
                </div>

                <button className={`plan-cta ${plan.popular ? 'primary' : 'secondary'}`}>
                  {plan.popular ? 'Request Demo' : 'Start Trial'}
                </button>

                <div className="plan-features">
                  <ul>
                    {plan.features.map((f, idx) => (
                      <li key={idx}>
                        <CheckIcon /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <section className="roi-section">
        <div className="roi-container">
          <h2 className="section-title">ROI Calculator</h2>
          <div className="roi-calculator">
            <label>Enter Monthly Claim Volume</label>
            <input
              type="number"
              value={claims}
              onChange={(e) => setClaims(Number(e.target.value))}
            />
            <div className="roi-results">
              <div className="roi-stat">
                <div className="roi-value">₹{traditional.toLocaleString()}</div>
                <div className="roi-label">Traditional Cost</div>
              </div>
              <div className="roi-arrow">→</div>
              <div className="roi-stat">
                <div className="roi-value savings">₹{pbi.toLocaleString()}</div>
                <div className="roi-label">With AI System</div>
              </div>
            </div>
            <div className="roi-savings">
              You Save: <strong>₹{savings.toLocaleString()}</strong>/month
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pricing-cta">
        <div className="cta-content">
          <h2>Join the Future of Insurance</h2>
          <p>Trusted by leading government institutions and financial organizations.</p>
          <div className="cta-buttons">
            <button className="cta-primary">Book a Demo</button>
            <button className="cta-secondary">Contact Us</button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Pricing;
