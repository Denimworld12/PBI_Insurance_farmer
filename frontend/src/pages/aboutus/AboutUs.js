import React from 'react';
import ProfileCard from './ProfileCard';
import './AboutUs.css';

const AboutUs = () => {
    const teamMembers = [
        {
            name: 'Nikhil Gupta',
            title: 'Lead Developer',
            handle: 'nikhilgupta',
            status: 'Building the Future',
            avatarUrl: '/images/nikhil.png',
            miniAvatarUrl: '/images/nikhil.png',
            role: 'Full Stack Engineer',
            bio: 'Passionate about building scalable insurance solutions with cutting-edge AI technologies.',
            expertise: ['React', 'Node.js', 'Python', 'AI/ML']
        },
        {
            name: 'Priya Patel',
            title: 'AI Specialist',
            handle: 'priyapatel',
            status: 'AI Researcher',
            avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&h=500&fit=crop',
            miniAvatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
            role: 'Machine Learning Engineer',
            bio: 'Specializing in computer vision and geospatial analysis for claim verification.',
            expertise: ['TensorFlow', 'PyTorch', 'Computer Vision', 'NLP']
        },
        {
            name: 'Rahul Verma',
            title: 'Backend Architect',
            handle: 'rahulverma',
            status: 'System Designer',
            avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&h=500&fit=crop',
            miniAvatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&h=500&fit=crop',
            role: 'DevOps & Backend Lead',
            bio: 'Expert in cloud infrastructure and real-time data processing for insurance analytics.',
            expertise: ['AWS', 'Docker', 'Kubernetes', 'Microservices']
        },
        {
            name: 'Sneha Reddy',
            title: 'Frontend Engineer',
            handle: 'snehareddy',
            status: 'UX Innovator',
            avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=500&h=500&fit=crop',
            miniAvatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
            role: 'UI/UX Developer',
            bio: 'Creating seamless user experiences for farmers with modern web technologies.',
            expertise: ['React', 'TypeScript', 'CSS', 'Design Systems']
        }
    ];

    const handleContactClick = (member) => {
        console.log(`Contacting ${member.name}`);
        // Add your contact logic here
    };

    return (
        <div className="about-us-page">
            {/* Hero Section */}
            {/* <section className="about-hero">
                <div className="hero-content">
                    <h1 className="hero-title">Meet Our Team</h1>
                    <p className="hero-subtitle">
                        We are Computer Engineers passionate about revolutionizing agricultural insurance through AI and technology
                    </p>
                    <div className="hero-stats">
                        <div className="stat-item">
                            <span className="stat-number">4</span>
                            <span className="stat-label">Engineers</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">10+</span>
                            <span className="stat-label">Technologies</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">1000+</span>
                            <span className="stat-label">Farmers Helped</span>
                        </div>
                    </div>
                </div>
            </section> */}

            {/* Mission Section */}
            <section className="mission-section">
                <div className="mission-content">
                    <h2 className="section-title">Our Mission</h2>
                    <p className="mission-text">
                        As Computer Engineering graduates, we leverage cutting-edge AI, machine learning, and cloud technologies
                        to transform the agricultural insurance industry. Our goal is to empower farmers with fair, fast, and
                        transparent claim processing through innovative verification systems.
                    </p>
                    <div className="tech-stack">
                        <div className="tech-category">
                            <h3>Frontend</h3>
                            <div className="tech-tags">
                                <span className="tech-tag">React</span>
                                <span className="tech-tag">TypeScript</span>
                                <span className="tech-tag">CSS3</span>
                            </div>
                        </div>
                        <div className="tech-category">
                            <h3>Backend</h3>
                            <div className="tech-tags">
                                <span className="tech-tag">Node.js</span>
                                <span className="tech-tag">Python</span>
                                <span className="tech-tag">Express</span>
                            </div>
                        </div>
                        <div className="tech-category">
                            <h3>AI/ML</h3>
                            <div className="tech-tags">
                                <span className="tech-tag">TensorFlow</span>
                                <span className="tech-tag">PyTorch</span>
                                <span className="tech-tag">OpenCV</span>
                            </div>
                        </div>
                        <div className="tech-category">
                            <h3>Infrastructure</h3>
                            <div className="tech-tags">
                                <span className="tech-tag">AWS</span>
                                <span className="tech-tag">Docker</span>
                                <span className="tech-tag">MongoDB</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Team Cards Section */}
            <section className="team-section">
                <h2 className="section-title">The Team</h2>
                <div className="team-grid">
                    {teamMembers.map((member, index) => (
                        <div key={index} className="team-member-wrapper">
                            <ProfileCard
                                avatarUrl={member.avatarUrl}
                                miniAvatarUrl={member.miniAvatarUrl}
                                name={member.name}
                                title={member.title}
                                handle={member.handle}
                                status={member.status}
                                contactText="Connect"
                                onContactClick={() => handleContactClick(member)}
                                enableTilt={true}
                                showBehindGradient={true}
                            />
                            <div className="member-bio">
                                <h3 className="member-role">{member.role}</h3>
                                <p className="member-description">{member.bio}</p>
                                <div className="member-expertise">
                                    {member.expertise.map((skill, idx) => (
                                        <span key={idx} className="expertise-tag">{skill}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* What We Do Section */}
            <section className="what-we-do">
                <h2 className="section-title">What We Built</h2>
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon">🎯</div>
                        <h3>AI-Powered Verification</h3>
                        <p>Real-time image analysis using computer vision to detect crop damage authenticity</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">📍</div>
                        <h3>GPS Geofencing</h3>
                        <p>EXIF metadata extraction and coordinate verification for location accuracy</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🌦️</div>
                        <h3>Weather Integration</h3>
                        <p>Cross-referencing claim data with real-time weather APIs for fraud detection</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">⚡</div>
                        <h3>Fast Processing</h3>
                        <p>Automated claim analysis reducing approval time from days to minutes</p>
                    </div>
                </div>
            </section>

            {/* Contact CTA */}
            <section className="cta-section">
                <div className="cta-content">
                    <h2>Ready to Transform Agriculture Insurance?</h2>
                    <p>Get in touch with our team to learn more about our technology</p>
                    <button className="cta-button">Contact Us</button>
                </div>
            </section>
        </div>
    );
};

export default AboutUs;
