import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function RegistrationForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [panCard, setPanCard] = useState('');

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        // 1. Create the user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
        });

        if (authError) {
            alert('Error creating account: ' + authError.message);
            return;
        }

        // 2. Insert their KYC data into the 'profiles' table you made in Step 1!
        if (authData.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([
                    {
                        id: authData.user.id, // Links to the secure Auth system
                        full_name: fullName,
                        pan_card: panCard,
                        role: 'viewer' // Default role
                    }
                ]);

            if (profileError) {
                alert('Account created, but failed to save KYC data.');
            } else {
                alert('Registration Successful! You are fully KYC compliant.');
            }
        }
    };

    return (
        <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md">
            <h2 className="text-xl font-bold mb-4">Register for Community Treasury</h2>
            <form onSubmit={handleRegister} className="flex flex-col gap-3">

                <input type="text" placeholder="Full Legal Name" required
                    className="border p-2 rounded"
                    onChange={(e) => setFullName(e.target.value)} />

                <input type="text" placeholder="PAN Card Number (Required for Tax)" required
                    className="border p-2 rounded uppercase"
                    onChange={(e) => setPanCard(e.target.value)} />

                <input type="email" placeholder="Email Address" required
                    className="border p-2 rounded"
                    onChange={(e) => setEmail(e.target.value)} />

                <input type="password" placeholder="Password" required
                    className="border p-2 rounded"
                    onChange={(e) => setPassword(e.target.value)} />

                <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
                    Complete KYC Registration
                </button>
            </form>
        </div>
    );
}