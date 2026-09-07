const API_BASE = 'http://localhost:3000/api/v1';

async function runTest() {
  console.log('=== Starting Subject Year & Toggle Verification Test ===');

  try {
    // 1. Log in as SUPER_ADMIN
    console.log('\n1. Logging in as SUPER_ADMIN...');
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@bit.ac.in',
        password: 'Admin@123',
      }),
    });
    const loginData = await loginRes.json();
    const token = loginData?.data?.accessToken || loginData?.token;
    if (!token) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }
    console.log('-> Logged in successfully. Token acquired.');

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // 2. Fetch semesters
    console.log('\n2. Fetching semesters to pick an appropriate semester for Year 2...');
    const semRes = await fetch(`${API_BASE}/academic/departments/semesters`, { headers });
    const semData = await semRes.json();
    const semesters = semData?.data || [];
    console.log(`-> Found ${semesters.length} semesters.`);
    
    // Pick Semester 3 or 4 (Year 2)
    let targetSem = semesters.find(s => s.number === 3 || s.number === 4) || semesters[0];
    if (!targetSem) {
      throw new Error('No semesters found in database to link subject with.');
    }
    console.log(`-> Selected semester: ${targetSem.name} (Semester #${targetSem.number}, id: ${targetSem.id})`);

    // 3. Create Subject with Year 2 and isLab: true (no programId, no credits)
    console.log('\n3. Creating Subject with year: 2, isLab: true (no programId, no credits)...');
    const testSubjectPayload = {
      name: `Test Autonomous Systems Lab ${Date.now()}`,
      code: `ASL-${Math.floor(1000 + Math.random() * 9000)}`,
      year: 2,
      semesterId: targetSem.id,
      isLab: true,
    };
    console.log('-> Payload:', JSON.stringify(testSubjectPayload, null, 2));

    const createRes = await fetch(`${API_BASE}/academic/departments/subjects`, {
      method: 'POST',
      headers,
      body: JSON.stringify(testSubjectPayload),
    });
    const createData = await createRes.json();
    console.log('-> Create response status:', createRes.status);
    const createdSubject = createData?.data;
    console.log('-> Created subject:', {
      id: createdSubject?.id,
      name: createdSubject?.name,
      code: createdSubject?.code,
      year: createdSubject?.year,
      semesterId: createdSubject?.semesterId,
      isLab: createdSubject?.isLab,
      credits: createdSubject?.credits,
      programId: createdSubject?.programId,
    });

    if (!createdSubject || createdSubject.year !== 2) {
      throw new Error(`Expected year to be 2, but got: ${createdSubject?.year}`);
    }
    if (createdSubject.isLab !== true) {
      throw new Error(`Expected isLab to be true, but got: ${createdSubject.isLab}`);
    }
    if (createdSubject.credits !== undefined) {
      throw new Error(`Expected credits to be removed, but got: ${createdSubject.credits}`);
    }
    if (createdSubject.programId !== undefined) {
      throw new Error(`Expected programId to be removed, but got: ${createdSubject.programId}`);
    }
    console.log('-> Verified: Subject created with Year 2, isLab: true, and NO programId/credits!');

    // 4. Verify in List
    console.log('\n4. Fetching subjects list to confirm persistence...');
    const listRes = await fetch(`${API_BASE}/academic/departments/subjects?includeInactive=true`, { headers });
    const listData = await listRes.json();
    const allSubjects = listData?.data || [];
    const found = allSubjects.find(s => s.id === createdSubject.id);
    if (!found) {
      throw new Error('Created subject not found in subjects list.');
    }
    console.log(`-> Subject confirmed in list with year: ${found.year}, isLab: ${found.isLab}.`);

    // 5. Update Subject: switch isLab to false, change year to 3
    console.log('\n5. Updating subject: toggle isLab to false, year to 3...');
    let sem5 = semesters.find(s => s.number === 5) || targetSem;
    const updateRes = await fetch(`${API_BASE}/academic/departments/subjects/${createdSubject.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        year: 3,
        semesterId: sem5.id,
        isLab: false,
      }),
    });
    const updateData = await updateRes.json();
    const updatedSubject = updateData?.data;
    console.log('-> Updated subject:', {
      id: updatedSubject?.id,
      year: updatedSubject?.year,
      semesterId: updatedSubject?.semesterId,
      isLab: updatedSubject?.isLab,
    });
    if (!updatedSubject || updatedSubject.year !== 3 || updatedSubject.isLab !== false) {
      throw new Error(`Subject update verification failed: year=${updatedSubject?.year}, isLab=${updatedSubject?.isLab}`);
    }
    console.log('-> Verified: Subject updated with year 3 and isLab: false successfully.');

    // 6. Clean up test subject
    console.log('\n6. Cleaning up test subject...');
    await fetch(`${API_BASE}/academic/departments/subjects/${createdSubject.id}`, {
      method: 'DELETE',
      headers,
    });
    console.log('-> Cleaned up test subject.');

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('\nTest failed with error:', err.message);
    process.exit(1);
  }
}

runTest();
