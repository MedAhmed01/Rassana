import { createAdminClient } from '@/lib/supabase';
import type { 
  LMSStudent, 
  CreateStudentRequest, 
  UpdateStudentRequest,
  LMSResult,
  LMSLoginRequest,
  LMSLoginResponse
} from '@/types/lms';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Create a new LMS student
 */
export async function createStudent(data: CreateStudentRequest): Promise<LMSResult<LMSStudent>> {
  try {
    const supabase = createAdminClient();
    
    // Hash the password
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    
    const { data: student, error } = await supabase
      .from('lms_students')
      .insert({
        username: data.username,
        email: data.email.toLowerCase(),
        phone: data.phone,
        class: data.class,
        password_hash: passwordHash,
        is_active: true,
      })
      .select('id, username, email, phone, class, is_active, created_at, updated_at')
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'A student with this email already exists' };
      }
      return { success: false, error: error.message };
    }
    
    return { success: true, data: student as LMSStudent };
  } catch (err) {
    return { success: false, error: 'Failed to create student' };
  }
}

/**
 * Update an LMS student
 */
export async function updateStudent(id: string, data: UpdateStudentRequest): Promise<LMSResult<LMSStudent>> {
  try {
    const supabase = createAdminClient();
    
    const updateData: any = {};
    if (data.username !== undefined) updateData.username = data.username;
    if (data.email !== undefined) updateData.email = data.email.toLowerCase();
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.class !== undefined) updateData.class = data.class;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.password) {
      updateData.password_hash = await bcrypt.hash(data.password, SALT_ROUNDS);
    }
    
    const { data: student, error } = await supabase
      .from('lms_students')
      .update(updateData)
      .eq('id', id)
      .select('id, username, email, phone, class, is_active, created_at, updated_at')
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'A student with this email already exists' };
      }
      return { success: false, error: error.message };
    }
    
    return { success: true, data: student as LMSStudent };
  } catch (err) {
    return { success: false, error: 'Failed to update student' };
  }
}


/**
 * Get all LMS students
 */
export async function getAllStudents(): Promise<LMSStudent[]> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_students')
      .select('id, username, email, phone, class, is_active, created_at, updated_at')
      .order('created_at', { ascending: false });
    
    if (error || !data) {
      return [];
    }
    
    return data as LMSStudent[];
  } catch (err) {
    return [];
  }
}

/**
 * Get an LMS student by ID
 */
export async function getStudentById(id: string): Promise<LMSStudent | null> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_students')
      .select('id, username, email, phone, class, is_active, created_at, updated_at')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data as LMSStudent;
  } catch (err) {
    return null;
  }
}

/**
 * Get an LMS student by email
 */
export async function getStudentByEmail(email: string): Promise<LMSStudent | null> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_students')
      .select('id, username, email, phone, class, is_active, created_at, updated_at')
      .eq('email', email.toLowerCase())
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data as LMSStudent;
  } catch (err) {
    return null;
  }
}

/**
 * Search students by username, email, or phone
 */
export async function searchStudents(query: string): Promise<LMSStudent[]> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_students')
      .select('id, username, email, phone, class, is_active, created_at, updated_at')
      .or(`username.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
      .order('created_at', { ascending: false });
    
    if (error || !data) {
      return [];
    }
    
    return data as LMSStudent[];
  } catch (err) {
    return [];
  }
}

/**
 * Delete an LMS student
 */
export async function deleteStudent(id: string): Promise<LMSResult<void>> {
  try {
    const supabase = createAdminClient();
    
    const { error } = await supabase
      .from('lms_students')
      .delete()
      .eq('id', id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to delete student' };
  }
}

/**
 * Authenticate an LMS student
 * Supports login with either email or username
 */
export async function authenticateStudent(data: LMSLoginRequest): Promise<LMSLoginResponse> {
  try {
    const supabase = createAdminClient();
    const identifier = data.email.toLowerCase().trim();
    
    console.log('Attempting login for identifier:', identifier);
    
    // First try to find by email
    let { data: student, error } = await supabase
      .from('lms_students')
      .select('*')
      .eq('email', identifier)
      .single();
    
    // If not found by email, try by username (case-insensitive)
    if (error || !student) {
      console.log('Not found by email, trying username...');
      const usernameResult = await supabase
        .from('lms_students')
        .select('*')
        .ilike('username', identifier)
        .single();
      
      student = usernameResult.data;
      error = usernameResult.error;
    }
    
    if (error || !student) {
      console.log('Student lookup failed:', { identifier, error: error?.message });
      return { success: false, error: 'Invalid credentials' };
    }
    
    console.log('Found student:', { id: student.id, username: student.username, email: student.email });
    
    if (!student.is_active) {
      return { success: false, error: 'Account is deactivated' };
    }
    
    // Verify password
    console.log('Verifying password...');
    console.log('Password hash from DB:', student.password_hash ? 'exists' : 'missing');
    
    const isValid = await bcrypt.compare(data.password, student.password_hash);
    
    if (!isValid) {
      console.log('Password verification failed for:', identifier);
      return { success: false, error: 'Invalid credentials' };
    }
    
    console.log('Login successful for:', identifier);
    
    // Return student without password hash
    const { password_hash, ...studentData } = student;
    
    return { 
      success: true, 
      student: studentData as LMSStudent,
    };
  } catch (err) {
    console.error('Authentication error:', err);
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Get students with active subscriptions to a topic
 */
export async function getStudentsByTopic(topicId: string): Promise<LMSStudent[]> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_subscriptions')
      .select(`
        student:lms_students (
          id, username, email, phone, class, is_active, created_at, updated_at
        )
      `)
      .eq('topic_id', topicId)
      .gt('expires_at', new Date().toISOString());
    
    if (error || !data) {
      return [];
    }
    
    return data.map((d: any) => d.student).filter(Boolean) as LMSStudent[];
  } catch (err) {
    return [];
  }
}
